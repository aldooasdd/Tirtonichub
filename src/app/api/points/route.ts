import { NextRequest } from "next/server";
import { prisma } from "@/server/db";

// Ace Points pelanggan dari nota penjualan (SalesReport) yang SUDAH final (approvedAt != null).
// Rule: 1 poin per Rp1.000 belanja (grandTotal) → floor(total / 1000). (300.000 → 300 poin)
// Loyalty dimulai 1 Nov 2026 WIB — nota sebelum itu tidak dihitung.
// Dipanggil app toko (lintas-repo) pakai header rahasia x-points-secret.

const SINCE = new Date("2026-10-31T17:00:00.000Z"); // 2026-11-01 00:00 WIB
const RP_PER_PT = 1000;

const normPhone = (v: string | null): string | null => {
  const d = (v ?? "").replace(/\D/g, "");
  if (!d) return null;
  const n = d.startsWith("62") ? d : d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("8") ? "62" + d : d;
  return n.length >= 9 && n.length <= 15 ? n : null;
};

export async function GET(req: NextRequest) {
  const secret = process.env.POINTS_API_SECRET;
  if (!secret || req.headers.get("x-points-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  const phone = normPhone(req.nextUrl.searchParams.get("phone"));
  if (!phone) return Response.json({ phone: null, total: 0, points: 0, count: 0, since: SINCE.toISOString() });

  const agg = await prisma.salesReport.aggregate({
    where: { phone, approvedAt: { not: null }, soldAt: { gte: SINCE } },
    _sum: { grandTotal: true },
    _count: true,
  });
  const total = agg._sum.grandTotal ?? 0;
  return Response.json({
    phone,
    total,
    points: Math.floor(total / RP_PER_PT),
    count: agg._count,
    since: SINCE.toISOString(),
  });
}
