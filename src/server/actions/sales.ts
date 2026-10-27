"use server";

import { prisma } from "@/server/db";
import { requireSalesInput } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { makeKey, putObject } from "@/server/storage";
import { notifyBosses } from "@/server/notify";
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

/** Simpan rekap penjualan → masuk ke Finance. */
export async function saveSalesReport(input: SaveInput): Promise<ActionResult> {
  const ctx = await requireSalesInput();
  if (!input.photoKey) return { ok: false, message: "Foto nota wajib." };
  const channel = input.channel === "online" ? "online" : "offline";
  // cabang asal: dari user pengirim (offline). Online = tanpa cabang toko.
  let branchName: string | null = null;
  if (channel === "offline" && ctx.branchId) {
    const br = await prisma.branch.findUnique({ where: { id: ctx.branchId }, select: { name: true } });
    branchName = br?.name ?? null;
  }
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
      photoKey: input.photoKey,
      createdById: ctx.userId,
    },
  });

  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "sales_report", entity: "SalesReport", entityId: rep.id });
  await notifyBosses({
    type: "sales_report",
    title: `Penjualan masuk: Rp ${new Intl.NumberFormat("id-ID").format(rep.grandTotal)}${rep.salesman ? ` · ${rep.salesman}` : ""}`,
    link: "/finance/penjualan",
  });
  return { ok: true };
}
