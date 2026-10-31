import { NextRequest } from "next/server";
import { prisma } from "@/server/db";

// Ace Points pelanggan dari nota penjualan (SalesReport) yang SUDAH final (approvedAt != null).
// 1 Ace = Rp1.000 (nilai tukar). Poin DIPEROLEH per nota: floor(grandTotal / rupiah-per-Ace tier).
// Tier ditentukan dari belanja 12 bulan berjalan SAAT nota dibuat (rolling, nota-nota sebelumnya).
// Loyalty dimulai 1 Nov 2026 WIB — nota sebelum itu tidak dihitung.
// Flag keanggotaan (coach=1 / prive=1) dikirim app toko (tabel Member ada di app toko):
//   coach → rate Green Rp50rb/Ace; prive → rate Privé Rp40rb/Ace. Dipakai kalau lebih bagus
//   dari tier belanja. Referral 2% murid dihitung di app toko, bukan di sini.
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

// Tier berbasis flag keanggotaan (bukan belanja). Green = coach, Privé-flag = undangan.
const GREEN = { name: "Green", label: "Tirtonic Green (Coach)", rpPerAce: 50_000 } as const;
const PRIVE = TIERS[0]; // Tirtonic Privé

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

  const coach = req.nextUrl.searchParams.get("coach") === "1";
  const prive = req.nextUrl.searchParams.get("prive") === "1";
  // Rate dari flag (rupiah-per-Ace lebih kecil = lebih bagus). Infinity = tak ada flag.
  const flagRate = prive ? PRIVE.rpPerAce : coach ? GREEN.rpPerAce : Infinity;

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
    earned += Math.floor(rows[i].grandTotal / Math.min(tierFor(window).rpPerAce, flagRate));
  }

  // Tier sekarang + progres: belanja 12 bulan terakhir sampai hari ini.
  const cutoff = Date.now() - YEAR_MS;
  const spend12mo = rows.reduce((s, r) => (r.soldAt.getTime() > cutoff ? s + r.grandTotal : s), 0);
  const total = rows.reduce((s, r) => s + r.grandTotal, 0);
  // Tier tampil: tier belanja, tapi flag coach/prive bisa menaikkan (rate lebih bagus).
  let cur: { name: string; label: string; rpPerAce: number } = tierFor(spend12mo);
  let flagged = false;
  if (prive) { cur = PRIVE; flagged = true; }
  else if (coach && GREEN.rpPerAce < cur.rpPerAce) { cur = GREEN; flagged = true; }

  // Member flag = sudah "top" lewat keanggotaan → tak ada target belanja naik tier.
  const next = flagged ? null : (TIERS[TIERS.indexOf(cur as (typeof TIERS)[number]) - 1] ?? null);
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
