import Link from "next/link";
import { requireOnlineSales } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";

type Item = { name: string; qty: number };
type Ch = "online" | "offline";
type SP = { semua?: string; tanggal?: string; cabang?: string };

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const ymd = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "");
const ALL_CAP = 500; // ponytail: "tampilkan semua" dibatasi 500 baris; tambah paginasi kalau sering lewat

/** Riwayat penjualan yang sudah disetujui: online & offline di kartu terpisah, 5 terbaru + tampilkan semua. */
export default async function RiwayatPenjualanPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireOnlineSales();
  const sp = await searchParams;
  const tanggal = ymd(sp.tanggal);
  const cabang = sp.cabang ?? "";
  const semua: Ch | null = sp.semua === "online" || sp.semua === "offline" ? sp.semua : null;

  // Filter tanggal = hari disetujui (WIB).
  const day = tanggal ? new Date(`${tanggal}T00:00:00+07:00`) : null;
  const approvedAt = { not: null, ...(day ? { gte: day, lt: new Date(day.getTime() + 86400_000) } : {}) };

  const branches = await prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  const load = (ch: Ch) =>
    prisma.salesReport.findMany({
      where: { channel: ch, approvedAt, ...(ch === "offline" && cabang ? { branchId: cabang } : {}) },
      orderBy: { approvedAt: "desc" },
      take: semua === ch ? ALL_CAP : semua ? 0 : 5,
      select: { id: true, soldAt: true, customer: true, branchName: true, grandTotal: true, items: true, approvedAt: true, approvedById: true },
    });
  const [online, offline] = await Promise.all([load("online"), load("offline")]);

  const ids = [...new Set([...online, ...offline].map((r) => r.approvedById).filter((x): x is string => !!x))];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
  const nameOf = new Map(users.map((u) => [u.id, u.fullName]));

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(tanggal && { tanggal }), ...(cabang && { cabang }), ...extra });
    const s = p.toString();
    return s ? `?${s}` : "?";
  };

  const card = (ch: Ch, rows: typeof online) => (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="font-semibold">{ch === "online" ? "Penjualan Online" : "Penjualan Offline (Cabang)"}</h2>
      {rows.length === 0 ? (
        <p className="text-14 text-muted-foreground">Belum ada riwayat.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-14">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2">Disetujui</th>
                <th className="p-2">Tgl jual</th>
                {ch === "offline" && <th className="p-2">Cabang</th>}
                <th className="p-2">Pelanggan</th>
                <th className="p-2">Barang</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2">Oleh</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const items = (Array.isArray(r.items) ? r.items : []) as Item[];
                return (
                  <tr key={r.id} className="border-b align-top last:border-b-0">
                    <td className="p-2 whitespace-nowrap">{r.approvedAt ? fmtWIB(r.approvedAt) : "-"}</td>
                    <td className="p-2 whitespace-nowrap">{fmtWIB(r.soldAt)}</td>
                    {ch === "offline" && <td className="p-2">{r.branchName || "-"}</td>}
                    <td className="p-2">{r.customer || "-"}</td>
                    <td className="p-2">{items.map((it) => `${it.qty || 1}× ${it.name}`).join(", ") || "-"}</td>
                    <td className="p-2 text-right tabular-nums">{rupiah(r.grandTotal)}</td>
                    <td className="p-2">{(r.approvedById && nameOf.get(r.approvedById)) || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {semua === ch && rows.length === ALL_CAP && (
            <p className="pt-2 text-12 text-muted-foreground">Menampilkan {ALL_CAP} terbaru. Pilih tanggal untuk melihat yang lebih lama.</p>
          )}
        </div>
      )}
      {(semua === ch || rows.length === 5) && (
        <Link
          href={semua === ch ? qs({}) : qs({ semua: ch })}
          className="block w-full rounded-md border py-2 text-center text-14 font-medium hover:bg-muted"
        >
          {semua === ch ? "Show less" : "Show more"}
        </Link>
      )}
    </section>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-24 font-semibold">Riwayat Penjualan</h1>
        <p className="text-14 text-muted-foreground">Penjualan online & offline yang sudah disetujui.</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        {semua && <input type="hidden" name="semua" value={semua} />}
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Tanggal disetujui
          <input type="date" name="tanggal" defaultValue={tanggal} className="h-9 rounded-md border bg-card px-2 text-14" />
        </label>
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Cabang (offline)
          <select name="cabang" defaultValue={cabang} className="h-9 rounded-md border bg-card px-2 text-14">
            <option value="">Semua cabang</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-9 rounded-md border bg-card px-3 text-14 font-medium">
          Terapkan
        </button>
        {(tanggal || cabang) && (
          <Link href={semua ? `?semua=${semua}` : "?"} className="h-9 px-2 text-14 leading-9 text-muted-foreground">
            Reset
          </Link>
        )}
      </form>

      {semua !== "offline" && card("online", online)}
      {semua !== "online" && card("offline", offline)}
    </div>
  );
}
