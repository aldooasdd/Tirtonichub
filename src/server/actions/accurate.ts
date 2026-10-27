"use server";

import { prisma } from "@/server/db";
import { requireFinance } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { parseAccurateViaN8n } from "@/server/n8n-accurate";
import { reconcile, type Reconcile } from "@/lib/accurate-match";

export type SyncResult = {
  ok: boolean;
  message?: string;
  report?: Reconcile & { markedCount: number; totalAccurate: number };
};

/** Sinkronkan penjualan dari PDF Accurate dengan rekap; tandai yang cocok. */
export async function syncAccurate(pdfBase64: string): Promise<SyncResult> {
  const ctx = await requireFinance();
  if (!pdfBase64) return { ok: false, message: "PDF kosong." };

  const sales = await parseAccurateViaN8n(pdfBase64);
  if (sales === null) return { ok: false, message: "Gagal baca PDF Accurate (layanan AI belum siap / error)." };
  if (sales.length === 0) return { ok: false, message: "Tak ada faktur terbaca di PDF." };

  const reports = await prisma.salesReport.findMany({
    where: { approvedAt: { not: null } },
    select: { id: true, notaNo: true, soldAt: true, grandTotal: true, customer: true },
    take: 2000,
  });
  const app = reports.map((r) => {
    const wib = new Date(r.soldAt.getTime() + 7 * 3600_000);
    return { id: r.id, notaNo: r.notaNo, dateKey: wib.toISOString().slice(0, 10), grandTotal: r.grandTotal, customer: r.customer };
  });

  const rec = reconcile(sales, app);
  if (rec.marks.length) {
    const now = new Date();
    await prisma.$transaction(
      rec.marks.map((m) =>
        prisma.salesReport.update({ where: { id: m.id }, data: { accurateSyncedAt: now, accurateRef: m.ref || null } }),
      ),
    );
  }

  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "accurate_sync", entity: "SalesReport", entityId: `sync:${rec.marks.length}` });
  return { ok: true, report: { ...rec, markedCount: rec.marks.length, totalAccurate: sales.length } };
}
