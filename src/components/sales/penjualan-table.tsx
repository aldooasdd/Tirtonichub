"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSalesReport, updateSalesReport } from "@/server/actions/sales";

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

type EditItem = { name: string; qty: number; price: number; total: number; note: string | null };
type EditPay = { method: string; amount: number };
export type NotaEdit = {
  notaNo: string;
  soldAt: string;
  customer: string;
  salesman: string;
  employee: string;
  subtotal: number;
  total: number;
  grandTotal: number;
  items: EditItem[];
  payments: EditPay[];
};

export type NotaItem = { name: string; qty: number; jual: number; cash: number };
export type NotaRow = {
  id: string;
  dateKey: string; // YYYY-MM-DD (WIB) utk filter
  tgl: string; // tampilan
  customer: string;
  branch: string;
  saluran: string;
  grandTotal: number;
  photoKey: string;
  productPhotoKeys?: string[];
  items: NotaItem[];
  edit: NotaEdit;
};

const todayWIB = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

export function PenjualanTable({ notas }: { notas: NotaRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tgl, setTgl] = useState(todayWIB); // default: hari ini (WIB)
  const [cabang, setCabang] = useState(""); // "" = semua
  const [saluran, setSaluran] = useState<"Offline" | "Online">("Offline"); // pisah rekap
  const [editId, setEditId] = useState<string | null>(null);

  function hapus(id: string) {
    if (!confirm("Hapus nota ini? Tidak bisa dibatalkan.")) return;
    startTransition(async () => {
      const r = await deleteSalesReport(id);
      if (!r.ok) alert(r.message ?? "Gagal hapus.");
      router.refresh();
    });
  }

  const cabangOpts = useMemo(
    () => Array.from(new Set(notas.map((n) => n.branch).filter((b) => b && b !== "-"))).sort(),
    [notas],
  );

  const shown = notas.filter((n) => n.saluran === saluran && (!tgl || n.dateKey === tgl) && (!cabang || n.branch === cabang));
  const total = shown.reduce((s, n) => s + n.grandTotal, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Rekap Penjualan</h1>
          <p className="text-14 text-muted-foreground">Offline dari nota Sales. Online diinput Admin (marketplace).</p>
        </div>
        <p className="text-14 font-semibold shrink-0">{rupiah(total)} <span className="text-12 font-normal text-muted-foreground">· {shown.length} nota</span></p>
      </div>

      <div className="inline-flex rounded-lg border bg-card p-0.5 text-14">
        {(["Offline", "Online"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSaluran(s)}
            className={`rounded-md px-3 py-1 font-medium ${saluran === s ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-12 text-muted-foreground">Tanggal</label>
          <input type="date" value={tgl} onChange={(e) => setTgl(e.target.value)} className="rounded-md border bg-card px-2 py-1 text-14" />
          {tgl && <button onClick={() => setTgl("")} className="text-12 text-primary">Semua</button>}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-12 text-muted-foreground">Cabang</label>
          <select value={cabang} onChange={(e) => setCabang(e.target.value)} className="rounded-md border bg-card px-2 py-1 text-14">
            <option value="">Semua</option>
            {cabangOpts.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border bg-card py-12 text-center text-muted-foreground">Tidak ada penjualan.</p>
      ) : (
        <div className="space-y-3">
          {shown.map((n) => (
            <div key={n.id} className="overflow-hidden rounded-lg border bg-card">
              <div className="flex items-start justify-between gap-3 border-b bg-muted/30 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium truncate">{n.customer}</p>
                  <p className="text-12 text-muted-foreground">
                    {n.tgl} · {n.branch} · <span className="rounded-full bg-muted px-2 py-0.5 text-11">{n.saluran}</span>
                    {" · "}
                    <a href={`/api/file?key=${encodeURIComponent(n.photoKey)}`} target="_blank" rel="noopener" className="text-primary">Lihat nota</a>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="text-14 font-semibold">{rupiah(n.grandTotal)}</p>
                  <button onClick={() => setEditId(n.id)} className="text-12 text-primary hover:underline">Edit</button>
                  <button
                    onClick={() => hapus(n.id)}
                    disabled={pending}
                    className="text-12 text-red-500 hover:underline disabled:opacity-50"
                  >
                    Hapus
                  </button>
                </div>
              </div>
              {n.productPhotoKeys && n.productPhotoKeys.length > 0 && (
                <div className="flex flex-wrap gap-2 border-b px-4 py-2">
                  {n.productPhotoKeys.map((k) => (
                    <a key={k} href={`/api/file?key=${encodeURIComponent(k)}`} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/file?key=${encodeURIComponent(k)}`} alt="Foto produk" className="h-14 w-14 rounded-md border object-cover" />
                    </a>
                  ))}
                </div>
              )}
              <table className="w-full text-14 border-collapse">
                <thead>
                  <tr className="border-b text-left text-12 text-muted-foreground">
                    <th className="px-4 py-1.5 font-medium">Nama Barang</th>
                    <th className="px-4 py-1.5 font-medium text-right">Kuantitas</th>
                    <th className="px-4 py-1.5 font-medium text-right">Penjualan</th>
                    <th className="px-4 py-1.5 font-medium text-right">Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {n.items.map((it, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-4 py-1.5">{it.name}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums">{it.qty}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums font-medium">{rupiah(it.jual)}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{it.cash ? rupiah(it.cash) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {editId && (() => {
        const n = notas.find((x) => x.id === editId);
        return n ? <EditNotaModal id={n.id} init={n.edit} onClose={() => setEditId(null)} /> : null;
      })()}
    </div>
  );
}

function EditNotaModal({ id, init, onClose }: { id: string; init: NotaEdit; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [d, setD] = useState<NotaEdit>(() => ({
    ...init,
    items: init.items.map((it) => ({ ...it })),
    payments: init.payments.map((p) => ({ ...p })),
  }));

  const setItem = (i: number, patch: Partial<EditItem>) =>
    setD((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const setPay = (i: number, patch: Partial<EditPay>) =>
    setD((x) => ({ ...x, payments: x.payments.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

  async function save() {
    setBusy(true);
    const r = await updateSalesReport({
      id,
      notaNo: d.notaNo,
      soldAt: d.soldAt || null,
      customer: d.customer,
      salesman: d.salesman,
      employee: d.employee,
      items: d.items,
      subtotal: d.subtotal,
      total: d.total,
      grandTotal: d.grandTotal,
      payments: d.payments,
    });
    setBusy(false);
    if (!r.ok) {
      setMsg(r.message ?? "Gagal simpan.");
      return;
    }
    onClose();
    router.refresh();
  }

  const inp = "w-full rounded-md border bg-card px-2 py-1 text-14";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-2xl space-y-4 rounded-lg border bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-16 font-semibold">Edit Nota</h2>
          <button onClick={onClose} className="text-14 text-muted-foreground">Tutup</button>
        </div>
        {msg && <p className="text-12 text-red-500">{msg}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1"><span className="text-12 text-muted-foreground">No. nota</span><input className={inp} value={d.notaNo} onChange={(e) => setD({ ...d, notaNo: e.target.value })} /></label>
          <label className="block space-y-1"><span className="text-12 text-muted-foreground">Waktu transaksi</span><input type="datetime-local" className={inp} value={d.soldAt} onChange={(e) => setD({ ...d, soldAt: e.target.value })} /></label>
          <label className="block space-y-1"><span className="text-12 text-muted-foreground">Pelanggan</span><input className={inp} value={d.customer} onChange={(e) => setD({ ...d, customer: e.target.value })} /></label>
          <label className="block space-y-1"><span className="text-12 text-muted-foreground">Salesman</span><input className={inp} value={d.salesman} onChange={(e) => setD({ ...d, salesman: e.target.value })} /></label>
          <label className="block space-y-1"><span className="text-12 text-muted-foreground">Karyawan</span><input className={inp} value={d.employee} onChange={(e) => setD({ ...d, employee: e.target.value })} /></label>
        </div>

        <div className="space-y-2">
          <p className="text-12 font-medium text-muted-foreground">Item</p>
          {d.items.map((it, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_60px_100px_100px_auto]">
              <input className={inp} placeholder="Nama" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
              <input className={inp} type="number" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} />
              <input className={inp} type="number" placeholder="Harga" value={it.price} onChange={(e) => setItem(i, { price: Number(e.target.value) })} />
              <input className={inp} type="number" placeholder="Total" value={it.total} onChange={(e) => setItem(i, { total: Number(e.target.value) })} />
              <button className="text-12 text-red-500" onClick={() => setD({ ...d, items: d.items.filter((_, j) => j !== i) })}>Hapus</button>
            </div>
          ))}
          <button className="text-12 text-primary" onClick={() => setD({ ...d, items: [...d.items, { name: "", qty: 1, price: 0, total: 0, note: null }] })}>+ Item</button>
        </div>

        <div className="space-y-2">
          <p className="text-12 font-medium text-muted-foreground">Pembayaran</p>
          {d.payments.map((p, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
              <input className={inp} placeholder="Metode" value={p.method} onChange={(e) => setPay(i, { method: e.target.value })} />
              <input className={inp} type="number" placeholder="Jumlah" value={p.amount} onChange={(e) => setPay(i, { amount: Number(e.target.value) })} />
              <button className="text-12 text-red-500" onClick={() => setD({ ...d, payments: d.payments.filter((_, j) => j !== i) })}>Hapus</button>
            </div>
          ))}
          <button className="text-12 text-primary" onClick={() => setD({ ...d, payments: [...d.payments, { method: "", amount: 0 }] })}>+ Pembayaran</button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1"><span className="text-12 text-muted-foreground">Subtotal</span><input className={inp} type="number" value={d.subtotal} onChange={(e) => setD({ ...d, subtotal: Number(e.target.value) })} /></label>
          <label className="block space-y-1"><span className="text-12 text-muted-foreground">Total</span><input className={inp} type="number" value={d.total} onChange={(e) => setD({ ...d, total: Number(e.target.value) })} /></label>
          <label className="block space-y-1"><span className="text-12 text-muted-foreground">Grand total</span><input className={inp} type="number" value={d.grandTotal} onChange={(e) => setD({ ...d, grandTotal: Number(e.target.value) })} /></label>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-14">Batal</button>
          <button onClick={save} disabled={busy} className="rounded-md bg-primary px-3 py-1.5 text-14 text-primary-foreground disabled:opacity-50">{busy ? "Menyimpan…" : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
}
