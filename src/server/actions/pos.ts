"use server";

import { prisma } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { requireChannel } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { rateLimit } from "@/server/rate-limit";
import { notifyBranchHeads } from "@/server/notify";
import { makeKey, putObject } from "@/server/storage";
import { deductPosStock } from "@/server/pos-stock";
import { best, buildCatalog, toProduct, type PosCatalog, type PosProduct } from "@/server/pos-catalog";
import { clearPosCookie, getPosBranch, notaPrefix, setPosCookie } from "@/server/pos";

type Res = { ok: boolean; message?: string };

// ---------- Login mesin ----------

/** Login mesin kasir: password menentukan cabang (password unik per cabang). */
export async function posLogin(password: string): Promise<Res> {
  const { ip } = await clientMeta();
  if (!rateLimit(`pos:ip:${ip ?? "x"}`, 10, 300)) return { ok: false, message: "Terlalu banyak percobaan. Coba lagi 5 menit lagi." };
  const pw = password.trim();
  if (!pw) return { ok: false, message: "Isi password cabang." };
  const branches = await prisma.branch.findMany({ where: { posPasswordHash: { not: null } }, select: { id: true, posPasswordHash: true } });
  const b = branches.find((x) => verifyPassword(pw, x.posPasswordHash));
  if (!b) return { ok: false, message: "Password salah." };
  await setPosCookie(b.id, b.posPasswordHash!);
  return { ok: true };
}

export async function posLogout(): Promise<Res> {
  await clearPosCookie();
  return { ok: true };
}

/** Tirtonic Channel: atur password kasir cabang. Ditolak bila sama dengan password cabang lain. */
export async function setBranchPosPassword(branchId: string, password: string): Promise<Res> {
  const ctx = await requireChannel();
  const pw = password.trim();
  if (pw.length < 6) return { ok: false, message: "Password kasir minimal 6 karakter." };
  const others = await prisma.branch.findMany({ where: { id: { not: branchId }, posPasswordHash: { not: null } }, select: { posPasswordHash: true } });
  if (others.some((o) => verifyPassword(pw, o.posPasswordHash))) return { ok: false, message: "Password ini sudah dipakai cabang lain — harus beda." };
  const target = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
  if (!target || /office/i.test(target.name)) return { ok: false, message: "Cabang Office tidak memakai kasir." };
  await prisma.branch.update({ where: { id: branchId }, data: { posPasswordHash: hashPassword(pw) } });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "pos_password", entity: "Branch", entityId: branchId });
  return { ok: true };
}

/** Tirtonic Channel: matikan kasir cabang (hapus password → semua mesin cabang itu keluar). */
export async function clearBranchPosPassword(branchId: string): Promise<Res> {
  const ctx = await requireChannel();
  await prisma.branch.update({ where: { id: branchId }, data: { posPasswordHash: null } });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "pos_password_clear", entity: "Branch", entityId: branchId });
  return { ok: true };
}

// ---------- Produk ----------

export type { PosProduct, PosCatalog, PosCatalogItem } from "@/server/pos-catalog";

async function requireBranch() {
  const b = await getPosBranch();
  if (!b) throw new Error("Mesin kasir belum login.");
  return b;
}

/** Scan / ketik SKU → produk (cocok persis, abaikan huruf besar-kecil). */
export async function posLookup(code: string): Promise<PosProduct | null> {
  await requireBranch();
  const c = code.trim();
  if (!c) return null;
  const items = await prisma.marketplaceItem.findMany({
    where: {
      deletedAt: null,
      OR: [{ localSku: { equals: c, mode: "insensitive" } }, { localSku: null, sku: { equals: c, mode: "insensitive" } }],
    },
  });
  return items.length ? toProduct(best(items)) : null;
}

export async function posCatalog(): Promise<PosCatalog> {
  return buildCatalog((await requireBranch()).id);
}

/** Tirtonic Channel: gudang marketplace milik cabang (dasar stok cabang di kasir). */
export async function setBranchWarehouses(branchId: string, keys: string[]): Promise<Res> {
  const ctx = await requireChannel();
  const clean = [...new Set(keys.filter((k) => /^(SHOPEE|TOKOPEDIA):/.test(k)))].slice(0, 50);
  await prisma.branch.update({ where: { id: branchId }, data: { warehouseIds: clean } });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "pos_warehouses", entity: "Branch", entityId: branchId, after: { warehouseIds: clean } });
  return { ok: true };
}

// ---------- Simpan transaksi ----------

export type PosSaleInput = {
  cashierId: string;
  salesId: string;
  customer: string;
  phone: string;
  items: { sku: string; name: string; qty: number; price: number; fromBranchId?: string | null }[]; // fromBranchId = stok diambil dari cabang ini
  discount: number;
  method: string; // "Tunai" | "Debit BCA" | "Debit BRI" | "Debit Mandiri" | "Transfer"
  paid: number; // uang diterima (tunai); metode lain = total
};
export type PosSaleResult = Res & { notaNo?: string; soldAt?: string; total?: number; change?: number };

const METHODS = ["Tunai", "Debit BCA", "Debit BRI", "Debit Mandiri", "Transfer"];
const int = (v: number) => Math.max(0, Math.round(Number(v)) || 0);
const normPhone = (v: string) => {
  const d = v.replace(/\D/g, "");
  const n = d.startsWith("62") ? d : d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("8") ? "62" + d : d;
  return n.length >= 9 && n.length <= 15 ? n : null;
};

/** Simpan penjualan kasir → masuk alur penjualan offline biasa (ACC Kepala Cabang → Finance). */
export async function posSave(input: PosSaleInput): Promise<PosSaleResult> {
  const branch = await requireBranch();
  const people = await prisma.user.findMany({
    where: { id: { in: [input.cashierId, input.salesId] }, branchId: branch.id, isActive: true },
    include: { roles: { include: { role: true } } },
  });
  const cashier = people.find((p) => p.id === input.cashierId);
  const sales = people.find((p) => p.id === input.salesId);
  if (!cashier) return { ok: false, message: "Pengguna kasir tidak valid — pilih ulang pengguna." };
  if (!sales) return { ok: false, message: "Pilih sales yang melayani." };

  const branchNames = new Map((await prisma.branch.findMany({ select: { id: true, name: true } })).map((b) => [b.id, b.name]));
  const valid = input.items.filter((i) => i.name?.trim());
  const items = valid.map((i) => {
    const qty = Math.max(1, Math.round(i.qty) || 1);
    const price = int(i.price);
    const from = i.fromBranchId && branchNames.get(i.fromBranchId);
    return { name: `${i.name.trim()}${i.sku ? ` (${i.sku})` : ""}`.slice(0, 200), qty, price, total: price * qty, note: from ? `Stok dari ${from}` : null };
  });
  if (items.length === 0) return { ok: false, message: "Keranjang kosong." };
  const phone = normPhone(input.phone ?? "");
  if (!phone) return { ok: false, message: "Nomor WA pelanggan wajib — untuk poin member." };
  if (!METHODS.includes(input.method)) return { ok: false, message: "Metode bayar tidak valid." };

  const subtotal = items.reduce((n, i) => n + i.total, 0);
  const discount = Math.min(int(input.discount), subtotal);
  const total = subtotal - discount;
  const paid = input.method === "Tunai" ? int(input.paid) : total;
  if (paid < total) return { ok: false, message: "Uang diterima kurang dari total." };

  // ponytail: nomor nota = hitung nota POS cabang + 1; dua mesin simpan di detik yang sama bisa
  // dapat nomor kembar. Pakai sequence DB bila cabang punya >1 mesin aktif.
  const count = await prisma.salesReport.count({ where: { branchId: branch.id, photoKey: "" } });
  const notaNo = `${notaPrefix(branch.name)}-${String(count + 1).padStart(4, "0")}`;
  const soldAt = new Date();

  const rep = await prisma.salesReport.create({
    data: {
      notaNo,
      soldAt,
      customer: input.customer?.trim().slice(0, 120) || null,
      phone,
      salesman: sales.fullName,
      salesUserId: sales.id,
      employee: cashier.fullName,
      items,
      subtotal,
      total,
      grandTotal: total,
      payments: [{ method: input.method, amount: paid }],
      channel: "offline",
      branchId: branch.id,
      branchName: branch.name,
      photoKey: "", // ponytail: "" = dari /pos (tanpa foto nota)
      createdById: cashier.id,
    },
  });

  const { ip } = await clientMeta();
  const role = cashier.roles[0]?.role.code;
  // Potong stok gudang marketplace di belakang (kasir tak menunggu API Tokopedia/Shopee).
  const stockLines = valid
    .filter((i) => i.sku && i.fromBranchId && branchNames.has(i.fromBranchId))
    .map((i) => ({ sku: i.sku, qty: Math.max(1, Math.round(i.qty) || 1), fromBranchId: i.fromBranchId! }));
  if (stockLines.length) void deductPosStock(stockLines, { notaNo, userId: cashier.id, role }).catch(() => {});
  if (role) await logActivity({ userId: cashier.id, activeRole: role, ip }, { action: "pos_sale", entity: "SalesReport", entityId: rep.id });
  await notifyBranchHeads(branch.id, {
    type: "sales_pending",
    title: `Penjualan kasir perlu ACC: Rp ${new Intl.NumberFormat("id-ID").format(total)} · ${sales.fullName}`,
    link: "/cabang/approval-penjualan",
  });
  return { ok: true, notaNo, soldAt: soldAt.toISOString(), total, change: paid - total };
}

// ---------- Campaign layar depan ----------

const CAMPAIGN_MIME: Record<string, { ext: string; video: boolean; max: number }> = {
  "image/jpeg": { ext: "jpg", video: false, max: 5 << 20 },
  "image/png": { ext: "png", video: false, max: 5 << 20 },
  "image/webp": { ext: "webp", video: false, max: 5 << 20 },
  "image/gif": { ext: "gif", video: false, max: 10 << 20 },
  "video/mp4": { ext: "mp4", video: true, max: 20 << 20 },
};

/** Tirtonic Channel: upload campaign (gambar/video) untuk layar pembeli. branchId kosong = semua cabang. */
export async function uploadPosCampaign(input: { title: string; base64: string; mime: string; branchId: string | null }): Promise<Res> {
  const ctx = await requireChannel();
  const t = CAMPAIGN_MIME[input.mime];
  if (!t) return { ok: false, message: "Format harus JPG, PNG, WebP, GIF, atau MP4." };
  const body = Buffer.from(input.base64, "base64");
  if (!body.length) return { ok: false, message: "File kosong." };
  if (body.length > t.max) return { ok: false, message: `File terlalu besar (maks ${t.max >> 20} MB).` };
  const key = makeKey("pos-campaign", t.ext);
  await putObject(key, body, input.mime);
  const c = await prisma.posCampaign.create({
    data: { title: input.title.trim().slice(0, 120) || "Campaign", mediaKey: key, isVideo: t.video, branchId: input.branchId || null },
  });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "pos_campaign_upload", entity: "PosCampaign", entityId: c.id });
  return { ok: true };
}

export async function togglePosCampaign(id: string, active: boolean): Promise<Res> {
  await requireChannel();
  await prisma.posCampaign.update({ where: { id }, data: { active } });
  return { ok: true };
}

export async function deletePosCampaign(id: string): Promise<Res> {
  const ctx = await requireChannel();
  await prisma.posCampaign.delete({ where: { id } });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "pos_campaign_delete", entity: "PosCampaign", entityId: id });
  return { ok: true };
}
