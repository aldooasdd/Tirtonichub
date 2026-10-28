"use server";

import { prisma } from "@/server/db";
import { requireSalesInput, requireFinance, requireOnlineSales, requireHeadBranch } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { parseWIB } from "@/lib/datetime";
import { clientMeta } from "@/server/request-meta";
import { makeKey, putObject } from "@/server/storage";
import { notifyBosses, notifyRole, notifyBranchHeads } from "@/server/notify";
import { parseSalesNotaViaN8n, type SalesItem, type SalesPayment } from "@/server/n8n-sales";

export type ActionResult = { ok: boolean; message?: string };

export type SalesScan = {
  ok: boolean;
  message?: string;
  photoKey?: string;
  parsed?: {
    notaNo: string | null;
    soldAt: string | null;
    branch: string | null;
    customer: string | null;
    salesman: string | null;
    employee: string | null;
    items: SalesItem[];
    subtotal: number;
    total: number;
    grandTotal: number;
    payments: SalesPayment[];
  };
  ocr?: boolean; // true bila n8n mengisi
};

/** Upload foto nota penjualan + ekstrak via n8n. Belum simpan DB (diedit dulu). */
export async function scanSalesNota(imageBase64: string, mimeType: string): Promise<SalesScan> {
  await requireSalesInput();
  if (!imageBase64) return { ok: false, message: "Foto nota kosong." };

  const key = makeKey("sales-nota", mimeType.includes("png") ? "png" : "jpg");
  try {
    await putObject(key, Buffer.from(imageBase64, "base64"), mimeType || "image/jpeg");
  } catch {
    return { ok: false, message: "Gagal simpan foto nota." };
  }

  const parsed = await parseSalesNotaViaN8n(imageBase64, mimeType);
  return {
    ok: true,
    photoKey: key,
    parsed: parsed ?? {
      notaNo: null, soldAt: null, branch: null, customer: null, salesman: null, employee: null,
      items: [], subtotal: 0, total: 0, grandTotal: 0, payments: [],
    },
    ocr: parsed !== null,
  };
}

/** Upload foto produk tambahan (tak dibaca AI). Return key storage. */
export async function uploadSalesPhoto(imageBase64: string, mimeType: string): Promise<{ ok: boolean; key?: string; message?: string }> {
  await requireSalesInput();
  if (!imageBase64) return { ok: false, message: "Foto kosong." };
  const key = makeKey("sales-produk", mimeType.includes("png") ? "png" : "jpg");
  try {
    await putObject(key, Buffer.from(imageBase64, "base64"), mimeType || "image/jpeg");
  } catch {
    return { ok: false, message: "Gagal simpan foto." };
  }
  return { ok: true, key };
}

type SaveInput = {
  photoKey: string;
  productPhotoKeys?: string[];
  notaNo?: string | null;
  soldAt?: string | null; // ISO; kosong → sekarang
  customer?: string | null;
  salesman?: string | null;
  employee?: string | null;
  items: SalesItem[];
  subtotal: number;
  total: number;
  grandTotal: number;
  payments: SalesPayment[];
  channel?: "online" | "offline";
  branch?: string | null; // cabang dari nota (hasil OCR / edit)
};

// Cocokkan teks cabang dari nota ke Branch. "Yogyakarta" → Jogja. "Office" tak dirutekan.
async function resolveBranchFromText(text: string | null): Promise<{ id: string | null; name: string | null }> {
  if (!text?.trim()) return { id: null, name: null };
  const t = text.toLowerCase().replace(/yogyakarta|yogya/g, "jogja");
  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  for (const b of branches) {
    const city = b.name.toLowerCase().split(/\s+/).pop() ?? "";
    if (city && city !== "office" && t.includes(city)) return { id: b.id, name: b.name };
  }
  return { id: null, name: null };
}

const clean = (v: string | null | undefined, max: number) => (v?.trim() ? v.trim().slice(0, max) : null);
const int = (v: number) => Math.max(0, Math.round(v) || 0);
const mapItems = (items: SalesItem[]) =>
  (items ?? [])
    .filter((i) => i.name?.trim())
    .map((i) => ({
      name: i.name.trim().slice(0, 200),
      qty: Math.max(1, Math.round(i.qty) || 1),
      price: int(i.price),
      total: int(i.total), // net; 0 utk diskon 100%
      note: clean(i.note, 300),
    }));
const mapPayments = (pays: SalesPayment[]) =>
  (pays ?? []).filter((p) => int(p.amount) > 0).map((p) => ({ method: (p.method || "-").slice(0, 60), amount: int(p.amount) }));

/** Simpan rekap penjualan → masuk ke Finance. */
export async function saveSalesReport(input: SaveInput): Promise<ActionResult> {
  const ctx = await requireSalesInput();
  if (!input.photoKey) return { ok: false, message: "Foto nota wajib." };
  const channel = input.channel === "online" ? "online" : "offline";
  // Cabang offline dari nota (OCR/edit). Cocok → routing Kepala Cabang cabang itu.
  // Tak cocok → fallback cabang user pengirim; tetap gagal → simpan teks mentah (hanya Direksi bisa ACC).
  let branchId: string | null = null;
  let branchName: string | null = null;
  if (channel === "offline") {
    const det = await resolveBranchFromText(input.branch ?? null);
    if (det.id) {
      branchId = det.id;
      branchName = det.name;
    } else if (ctx.branchId) {
      const br = await prisma.branch.findUnique({ where: { id: ctx.branchId }, select: { name: true } });
      branchId = ctx.branchId;
      branchName = br?.name ?? null;
    } else {
      branchName = clean(input.branch, 120);
    }
  }
  // Offline wajib ACC Kepala Cabang; online wajib ACC Admin. Dua-duanya approvedAt null dulu.
  const approvedAt = null;
  const items = (input.items ?? []).filter((i) => i.name?.trim());
  if (items.length === 0 && input.grandTotal <= 0) return { ok: false, message: "Isi minimal 1 item atau total." };

  const soldAt = input.soldAt && !Number.isNaN(Date.parse(input.soldAt)) ? parseWIB(input.soldAt) : new Date();

  const rep = await prisma.salesReport.create({
    data: {
      notaNo: clean(input.notaNo, 60),
      soldAt,
      customer: clean(input.customer, 120),
      salesman: clean(input.salesman, 120),
      employee: clean(input.employee, 120),
      items: items.map((i) => ({
        name: i.name.trim().slice(0, 200),
        qty: Math.max(1, Math.round(i.qty) || 1),
        price: int(i.price),
        total: int(i.total),
        note: clean(i.note, 300),
      })),
      subtotal: int(input.subtotal),
      total: int(input.total),
      grandTotal: int(input.grandTotal) || int(input.total),
      payments: (input.payments ?? [])
        .filter((p) => int(p.amount) > 0)
        .map((p) => ({ method: (p.method || "-").slice(0, 60), amount: int(p.amount) })),
      channel,
      branchName,
      branchId,
      approvedAt,
      photoKey: input.photoKey,
      productPhotoKeys: (input.productPhotoKeys ?? []).slice(0, 20),
      createdById: ctx.userId,
    },
  });

  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "sales_report", entity: "SalesReport", entityId: rep.id });
  const rupiah = new Intl.NumberFormat("id-ID").format(rep.grandTotal);
  if (channel === "offline") {
    // Tahap 1: ACC Kepala Cabang cabang asal (baru lanjut ke Finance).
    await notifyBranchHeads(rep.branchId, {
      type: "sales_pending",
      title: `Penjualan perlu ACC cabang: Rp ${rupiah}${rep.salesman ? ` · ${rep.salesman}` : ""}`,
      link: "/cabang/approval-penjualan",
    });
  } else {
    // Online: minta ACC Order Specialist dulu.
    await notifyRole("ORDER_SPECIALIST", {
      type: "sales_pending",
      title: `Penjualan online perlu ACC: Rp ${rupiah}${rep.salesman ? ` · ${rep.salesman}` : ""}`,
      link: "/penjualan-online",
    });
  }
  return { ok: true };
}

/** Admin/Boss: setujui penjualan online → masuk Finance. */
export async function approveOnlineSales(id: string): Promise<ActionResult> {
  const ctx = await requireOnlineSales();
  if (!id) return { ok: false, message: "ID kosong." };
  const rep = await prisma.salesReport.findUnique({
    where: { id },
    select: { id: true, channel: true, approvedAt: true, grandTotal: true },
  });
  if (!rep) return { ok: false, message: "Nota tidak ditemukan." };
  if (rep.channel !== "online") return { ok: false, message: "Hanya penjualan online." };
  if (rep.approvedAt) return { ok: false, message: "Sudah disetujui." };

  await prisma.salesReport.update({ where: { id }, data: { approvedAt: new Date(), approvedById: ctx.userId } });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "sales_online_approve", entity: "SalesReport", entityId: id });
  await notifyBosses({
    type: "sales_report",
    title: `Penjualan online disetujui: Rp ${new Intl.NumberFormat("id-ID").format(rep.grandTotal)}`,
    link: "/finance/penjualan",
  });
  return { ok: true };
}

/** Admin/Boss: tolak penjualan online (hapus, belum masuk Finance). */
export async function rejectOnlineSales(id: string): Promise<ActionResult> {
  const ctx = await requireOnlineSales();
  if (!id) return { ok: false, message: "ID kosong." };
  const rep = await prisma.salesReport.findUnique({
    where: { id },
    select: { id: true, channel: true, approvedAt: true },
  });
  if (!rep) return { ok: false, message: "Nota tidak ditemukan." };
  if (rep.channel !== "online") return { ok: false, message: "Hanya penjualan online." };
  if (rep.approvedAt) return { ok: false, message: "Sudah disetujui, tak bisa ditolak." };

  await prisma.salesReport.delete({ where: { id } });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "sales_online_reject", entity: "SalesReport", entityId: id });
  return { ok: true };
}

/** Kepala Cabang: ACC tahap 1 penjualan offline cabangnya → lanjut ke Finance. */
export async function approveBranchSalesReport(id: string): Promise<ActionResult> {
  const ctx = await requireHeadBranch();
  if (!id) return { ok: false, message: "ID kosong." };
  const rep = await prisma.salesReport.findUnique({
    where: { id },
    select: { id: true, channel: true, branchId: true, branchApprovedAt: true, grandTotal: true },
  });
  if (!rep) return { ok: false, message: "Nota tidak ditemukan." };
  if (rep.channel !== "offline") return { ok: false, message: "Hanya penjualan offline." };
  if (ctx.branchId && rep.branchId !== ctx.branchId) return { ok: false, message: "Beda cabang." };
  if (rep.branchApprovedAt) return { ok: false, message: "Sudah di-ACC cabang." };

  await prisma.salesReport.update({ where: { id }, data: { branchApprovedAt: new Date(), branchApprovedById: ctx.userId } });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "sales_branch_approve", entity: "SalesReport", entityId: id });
  await notifyRole("FINANCE", {
    type: "sales_pending",
    title: `Penjualan perlu ACC Finance: Rp ${new Intl.NumberFormat("id-ID").format(rep.grandTotal)}`,
    link: "/cabang/penjualan",
  });
  return { ok: true };
}

/** Kepala Cabang: tolak penjualan offline cabangnya (hapus, sebelum Finance). */
export async function rejectBranchSalesReport(id: string): Promise<ActionResult> {
  const ctx = await requireHeadBranch();
  if (!id) return { ok: false, message: "ID kosong." };
  const rep = await prisma.salesReport.findUnique({
    where: { id },
    select: { id: true, channel: true, branchId: true, branchApprovedAt: true, approvedAt: true },
  });
  if (!rep) return { ok: false, message: "Nota tidak ditemukan." };
  if (rep.channel !== "offline") return { ok: false, message: "Hanya penjualan offline." };
  if (ctx.branchId && rep.branchId !== ctx.branchId) return { ok: false, message: "Beda cabang." };
  if (rep.approvedAt) return { ok: false, message: "Sudah di-ACC Finance, tak bisa ditolak." };

  await prisma.salesReport.delete({ where: { id } });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "sales_branch_reject", entity: "SalesReport", entityId: id });
  return { ok: true };
}

/** Finance/Boss/Admin: ACC tahap 2 penjualan offline → masuk rekap Finance. */
export async function approveSalesReport(id: string): Promise<ActionResult> {
  const ctx = await requireFinance();
  if (!id) return { ok: false, message: "ID kosong." };
  const rep = await prisma.salesReport.findUnique({
    where: { id },
    select: { id: true, channel: true, branchId: true, branchApprovedAt: true, approvedAt: true, grandTotal: true },
  });
  if (!rep) return { ok: false, message: "Nota tidak ditemukan." };
  if (rep.channel !== "offline") return { ok: false, message: "Hanya penjualan offline yang perlu ACC." };
  if (!rep.branchApprovedAt) return { ok: false, message: "Belum di-ACC Kepala Cabang." };
  if (rep.approvedAt) return { ok: false, message: "Sudah disetujui." };

  await prisma.salesReport.update({
    where: { id },
    data: { approvedAt: new Date(), approvedById: ctx.userId },
  });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "sales_report_approve", entity: "SalesReport", entityId: id });
  await notifyBosses({
    type: "sales_report",
    title: `Penjualan disetujui cabang: Rp ${new Intl.NumberFormat("id-ID").format(rep.grandTotal)}`,
    link: "/finance/penjualan",
  });
  return { ok: true };
}

/** Finance/Boss/Admin: tolak penjualan offline (hapus, belum masuk Finance). */
export async function rejectSalesReport(id: string): Promise<ActionResult> {
  const ctx = await requireFinance();
  if (!id) return { ok: false, message: "ID kosong." };
  const rep = await prisma.salesReport.findUnique({
    where: { id },
    select: { id: true, channel: true, approvedAt: true },
  });
  if (!rep) return { ok: false, message: "Nota tidak ditemukan." };
  if (rep.channel !== "offline") return { ok: false, message: "Hanya penjualan offline." };
  if (rep.approvedAt) return { ok: false, message: "Sudah disetujui, tak bisa ditolak." };

  await prisma.salesReport.delete({ where: { id } });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "sales_report_reject", entity: "SalesReport", entityId: id });
  return { ok: true };
}

type UpdateInput = {
  id: string;
  notaNo?: string | null;
  soldAt?: string | null;
  customer?: string | null;
  salesman?: string | null;
  employee?: string | null;
  items: SalesItem[];
  subtotal: number;
  total: number;
  grandTotal: number;
  payments: SalesPayment[];
};

/** Edit satu nota penjualan (Finance/Boss). */
export async function updateSalesReport(input: UpdateInput): Promise<ActionResult> {
  const ctx = await requireFinance();
  if (!input.id) return { ok: false, message: "ID kosong." };
  const exists = await prisma.salesReport.findUnique({ where: { id: input.id }, select: { id: true } });
  if (!exists) return { ok: false, message: "Nota tidak ditemukan." };

  const items = mapItems(input.items);
  if (items.length === 0 && input.grandTotal <= 0) return { ok: false, message: "Isi minimal 1 item atau total." };
  const soldAt = input.soldAt && !Number.isNaN(Date.parse(input.soldAt)) ? parseWIB(input.soldAt) : undefined;

  await prisma.salesReport.update({
    where: { id: input.id },
    data: {
      notaNo: clean(input.notaNo, 60),
      ...(soldAt ? { soldAt } : {}),
      customer: clean(input.customer, 120),
      salesman: clean(input.salesman, 120),
      employee: clean(input.employee, 120),
      items,
      subtotal: int(input.subtotal),
      total: int(input.total),
      grandTotal: int(input.grandTotal) || int(input.total),
      payments: mapPayments(input.payments),
    },
  });

  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "sales_report_edit", entity: "SalesReport", entityId: input.id });
  return { ok: true };
}

/** Hapus satu nota penjualan (Finance/Boss). Foto di storage dibiarkan (dibersihkan terpisah bila perlu). */
export async function deleteSalesReport(id: string): Promise<ActionResult> {
  const ctx = await requireFinance();
  if (!id) return { ok: false, message: "ID kosong." };
  const rep = await prisma.salesReport.findUnique({ where: { id }, select: { id: true } });
  if (!rep) return { ok: false, message: "Nota tidak ditemukan." };
  await prisma.salesReport.delete({ where: { id } });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "sales_report_delete", entity: "SalesReport", entityId: id });
  return { ok: true };
}
