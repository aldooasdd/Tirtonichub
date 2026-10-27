"use server";

import { prisma } from "@/server/db";
import { requireSalesInput, requireFinance, requireHeadBranch } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { makeKey, putObject } from "@/server/storage";
import { notifyBosses, notifyBranchHeads } from "@/server/notify";
import { parseSalesNotaViaN8n, type SalesItem, type SalesPayment } from "@/server/n8n-sales";

export type ActionResult = { ok: boolean; message?: string };

export type SalesScan = {
  ok: boolean;
  message?: string;
  photoKey?: string;
  parsed?: {
    notaNo: string | null;
    soldAt: string | null;
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
      notaNo: null, soldAt: null, customer: null, salesman: null, employee: null,
      items: [], subtotal: 0, total: 0, grandTotal: 0, payments: [],
    },
    ocr: parsed !== null,
  };
}

type SaveInput = {
  photoKey: string;
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
};

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
  // cabang asal: dari user pengirim (offline). Online = tanpa cabang toko.
  let branchName: string | null = null;
  const branchId = channel === "offline" ? ctx.branchId : null;
  if (branchId) {
    const br = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
    branchName = br?.name ?? null;
  }
  // Offline wajib ACC Kepala Cabang dulu (approvedAt null). Online auto-approve.
  const approvedAt = channel === "online" ? new Date() : null;
  const items = (input.items ?? []).filter((i) => i.name?.trim());
  if (items.length === 0 && input.grandTotal <= 0) return { ok: false, message: "Isi minimal 1 item atau total." };

  const soldAt = input.soldAt && !Number.isNaN(Date.parse(input.soldAt)) ? new Date(input.soldAt) : new Date();

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
      createdById: ctx.userId,
    },
  });

  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "sales_report", entity: "SalesReport", entityId: rep.id });
  const rupiah = new Intl.NumberFormat("id-ID").format(rep.grandTotal);
  if (channel === "offline") {
    // Minta ACC Kepala Cabang cabang tsb (belum masuk Finance).
    await notifyBranchHeads(branchId, {
      type: "sales_pending",
      title: `Penjualan perlu ACC: Rp ${rupiah}${rep.salesman ? ` · ${rep.salesman}` : ""}`,
      link: "/cabang/penjualan",
    });
  } else {
    await notifyBosses({
      type: "sales_report",
      title: `Penjualan online masuk: Rp ${rupiah}`,
      link: "/finance/penjualan",
    });
  }
  return { ok: true };
}

/** Kepala Cabang (cabangnya) / Boss: setujui penjualan offline → masuk Finance. */
export async function approveSalesReport(id: string): Promise<ActionResult> {
  const ctx = await requireHeadBranch();
  if (!id) return { ok: false, message: "ID kosong." };
  const rep = await prisma.salesReport.findUnique({
    where: { id },
    select: { id: true, channel: true, branchId: true, approvedAt: true, grandTotal: true },
  });
  if (!rep) return { ok: false, message: "Nota tidak ditemukan." };
  if (rep.channel !== "offline") return { ok: false, message: "Hanya penjualan offline yang perlu ACC." };
  if (rep.approvedAt) return { ok: false, message: "Sudah disetujui." };
  // Kepala Cabang hanya cabangnya sendiri; Boss semua.
  if (ctx.activeRole !== "BOSS" && rep.branchId !== ctx.branchId) return { ok: false, message: "Bukan cabang Anda." };

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

/** Kepala Cabang (cabangnya) / Boss: tolak penjualan offline (hapus, belum masuk Finance). */
export async function rejectSalesReport(id: string): Promise<ActionResult> {
  const ctx = await requireHeadBranch();
  if (!id) return { ok: false, message: "ID kosong." };
  const rep = await prisma.salesReport.findUnique({
    where: { id },
    select: { id: true, channel: true, branchId: true, approvedAt: true },
  });
  if (!rep) return { ok: false, message: "Nota tidak ditemukan." };
  if (rep.channel !== "offline") return { ok: false, message: "Hanya penjualan offline." };
  if (rep.approvedAt) return { ok: false, message: "Sudah disetujui, tak bisa ditolak." };
  if (ctx.activeRole !== "BOSS" && rep.branchId !== ctx.branchId) return { ok: false, message: "Bukan cabang Anda." };

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
  const soldAt = input.soldAt && !Number.isNaN(Date.parse(input.soldAt)) ? new Date(input.soldAt) : undefined;

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
