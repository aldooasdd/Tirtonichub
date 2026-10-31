import { NextRequest } from "next/server";
import { prisma } from "@/server/db";

// Ace Points pelanggan dari nota penjualan (SalesReport) yang SUDAH final (approvedAt != null).
// 1 Ace = Rp1.000 (nilai tukar). Poin DIPEROLEH per nota: floor(grandTotal / rupiah-per-Ace tier).
// Tier ditentukan dari belanja 12 bulan berjalan SAAT nota dibuat (rolling, nota-nota sebelumnya).
// Loyalty dimulai 1 Nov 2026 WIB — nota sebelum itu tidak dihitung.
// Catatan: tier Green (coach) & Privé-by-invitation belum di sini — butuh tabel Member (fase 3b).
// Dipanggil app toko (lintas-repo) pakai header rahasia x-points-secret.

const SINCE = new Date("2026-10-31T17:00:00.000Z"); // 2026-11-01 00:00 WIB
const ACE_VALUE = 1000; // 1 Ace = Rp1.000
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Tier berbasis belanja 12 bulan. rpPerAce = rupiah belanja untuk dapat 1 Ace.
// Urut dari syarat tertinggi ke terendah; tier pertama yang lolos dipakai.
const TIERS = [
  { name: "Prive", label: "Tirtonic Privé", qualify: 50_000_000, rpPerAce: 40_000 },
  { name: "Signature", label: "Tirtonic Signature", qualify: 15_000_000, rpPerAce: 65_000 },
  { name: "White", label: "Tirtonic White", qualify: 0, rpPerAce: 100_000 },
] as const;

const tierFor = (spend12mo: number) => TIERS.find((t) => spend12mo >= t.qualify) ?? TIERS[TIERS.length - 1];

const normPhone = (v: string | null): string | null => {
  const d = (v ?? "").replace(/\D/g, "");
  if (!d) return null;
  const n = d.startsWith("62") ? d : d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("8") ? "62" + d : d;
  return n.length >= 9 && n.length <= 15 ? n : null;
};

const emptyPayload = () => {
  const cur = tierFor(0);
  const next = TIERS[TIERS.indexOf(cur) - 1] ?? null;
  return {
    phone: null,
    since: SINCE.toISOString(),
    tier: cur.name,
    tierLabel: cur.label,
    rpPerAce: cur.rpPerAce,
    balance: 0,
    points: 0, // kompat lama
    rp: 0,
    spend12mo: 0,
    total: 0,
    nextTier: next?.name ?? null,
    nextTierLabel: next?.label ?? null,
    spendToNext: next ? next.qualify : 0,
    pct: 0,
    count: 0,
  };
};

export async function GET(req: NextRequest) {
  const secret = process.env.POINTS_API_SECRET;
  if (!secret || req.headers.get("x-points-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  const phone = normPhone(req.nextUrl.searchParams.get("phone"));
  if (!phone) return Response.json(emptyPayload());

  const rows = await prisma.salesReport.findMany({
    where: { phone, approvedAt: { not: null }, soldAt: { gte: SINCE } },
    select: { soldAt: true, grandTotal: true },
    orderBy: { soldAt: "asc" },
  });

  // Poin tiap nota pakai tier dari belanja 12 bulan berjalan SAMPAI nota itu (termasuk nota ybs).
  // Cocok dgn simulasi dokumen: Signature 20jt→307, Privé 60jt→1500.
  // ponytail: O(n²) atas nota 1 pelanggan (sedikit). Kalau 1 nomor pernah ribuan nota, ganti prefix-sum.
  let earned = 0;
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i].soldAt.getTime();
    let window = 0;
    for (let j = 0; j <= i; j++) {
      if (rows[j].soldAt.getTime() > t - YEAR_MS) window += rows[j].grandTotal;
    }
    earned += Math.floor(rows[i].grandTotal / tierFor(window).rpPerAce);
  }

  // Tier sekarang + progres: belanja 12 bulan terakhir sampai hari ini.
  const cutoff = Date.now() - YEAR_MS;
  const spend12mo = rows.reduce((s, r) => (r.soldAt.getTime() > cutoff ? s + r.grandTotal : s), 0);
  const total = rows.reduce((s, r) => s + r.grandTotal, 0);
  const cur = tierFor(spend12mo);
  const next = TIERS[TIERS.indexOf(cur) - 1] ?? null; // tier lebih tinggi = index lebih kecil
  const spendToNext = next ? Math.max(0, next.qualify - spend12mo) : 0;
  const pct = next ? Math.round((spend12mo / next.qualify) * 100) : 100;

  return Response.json({
    phone,
    since: SINCE.toISOString(),
    tier: cur.name,
    tierLabel: cur.label,
    rpPerAce: cur.rpPerAce,
    balance: earned,
    points: earned, // kompat lama
    rp: earned * ACE_VALUE,
    spend12mo,
    total,
    nextTier: next?.name ?? null,
    nextTierLabel: next?.label ?? null,
    spendToNext,
    pct: Math.max(0, Math.min(100, pct)),
    count: rows.length,
  });
}
