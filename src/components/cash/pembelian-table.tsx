"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCashout, toggleCashoutChecked, updateCashout } from "@/server/actions/cashout";
import { fmtInt } from "@/lib/money-input";
import { CASHOUT_SOURCES, sourceLabel } from "@/lib/cashout-source";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const CATS = ["Keperluan Kantor", "Ongkos Kirim"]; // sama dengan form Input Pembelian

export type PembelianRow = {
  id: string;
  tgl: string;
  spentAtLocal: string; // "YYYY-MM-DDTHH:mm" WIB, utk form edit
  category: string;
  branch: string;
  branchId: string | null;
  source: string;
  description: string;
  by: string;
  amount: number;
  photoKey: string | null;
  checked: boolean;
  checkedBy: string | null;
};

type Branch = { id: string; name: string };
const field = "h-9 w-full rounded-md border bg-background px-2 text-14";

export function PembelianTable({ rows, branches }: { rows: PembelianRow[]; branches: Branch[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ spentAt: "", category: "", branchId: "", source: "KASIR", description: "", amount: "" });
  const [err, setErr] = useState<string | null>(null);

  function toggle(id: string, next: boolean) {
    setBusyId(id);
    start(async () => {
      const r = await toggleCashoutChecked(id, next);
      setBusyId(null);
      if (!r.ok) alert(r.message ?? "Gagal.");
      else router.refresh();
    });
  }

  function remove(r: PembelianRow) {
    if (!confirm(`Hapus pembelian "${r.description}" (${rupiah(r.amount)})? Tidak bisa dibatalkan.`)) return;
    setBusyId(r.id);
    start(async () => {
      const res = await deleteCashout(r.id).catch(() => ({ ok: false, message: "Gagal hapus. Muat ulang halaman lalu coba lagi." }));
      setBusyId(null);
      if (!res.ok) alert(res.message ?? "Gagal hapus.");
      else router.refresh();
    });
  }

  function openEdit(r: PembelianRow) {
    setErr(null);
    setEditId(r.id);
    setForm({
      spentAt: r.spentAtLocal,
      category: r.category === "-" ? "" : r.category,
      branchId: r.branchId ?? "",
      source: r.source,
      description: r.description,
      amount: String(r.amount),
    });
  }

  function save() {
    if (!editId) return;
    const id = editId;
    start(async () => {
      const r = await updateCashout(id, {
        spentAt: form.spentAt,
        category: form.category,
        branchId: form.branchId || null,
        source: form.source,
        description: form.description,
        amount: Number(form.amount.replace(/\D/g, "")) || 0,
      }).catch(() => ({ ok: false, message: "Gagal simpan. Muat ulang halaman lalu coba lagi." }));
      if (!r.ok) return setErr(r.message ?? "Gagal simpan.");
      setEditId(null);
      router.refresh();
    });
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const checkedCount = rows.filter((r) => r.checked).length;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-24 font-semibold">Rekap Pembelian</h1>
        <p className="text-14 text-muted-foreground">
          Dicek {checkedCount}/{rows.length} · Total: <span className="font-semibold text-foreground">{rupiah(total)}</span>
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Belum ada pembelian.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-14">
            <thead>
              <tr className="border-b bg-card text-left text-muted-foreground">
                <th className="p-3">Cek</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Jenis</th>
                <th className="p-3">Cabang / sumber</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3">Oleh</th>
                <th className="p-3 text-right">Jumlah</th>
                <th className="p-3">Nota</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) =>
                editId === r.id ? (
                  <tr key={r.id} className="border-b bg-muted/40 align-top last:border-b-0">
                    <td className="p-3" />
                    <td className="p-3">
                      <input type="datetime-local" value={form.spentAt} onChange={set("spentAt")} className={field} aria-label="Tanggal" />
                    </td>
                    <td className="p-3">
                      <select value={form.category} onChange={set("category")} className={field} aria-label="Jenis">
                        {[...new Set([...CATS, form.category].filter(Boolean))].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <select value={form.branchId} onChange={set("branchId")} className={field} aria-label="Cabang">
                        <option value="">-</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <select value={form.source} onChange={set("source")} className={`${field} mt-2`} aria-label="Sumber uang">
                        {CASHOUT_SOURCES.map((x) => (
                          <option key={x.key} value={x.key}>
                            {x.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <textarea value={form.description} onChange={set("description")} rows={2} className="w-full min-w-48 rounded-md border bg-background px-2 py-1 text-14" aria-label="Keterangan" />
                      {err && <p className="mt-1 text-12 text-destructive">{err}</p>}
                    </td>
                    <td className="p-3">{r.by}</td>
                    <td className="p-3">
                      <input inputMode="numeric" value={fmtInt(form.amount)} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/\D/g, "") }))} className={`${field} min-w-28 text-right`} aria-label="Jumlah" />
                    </td>
                    <td className="p-3" />
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={save} disabled={pending} className="h-9 rounded-md bg-primary px-3 text-14 font-medium text-primary-foreground disabled:opacity-50">
                          {pending ? "…" : "Simpan"}
                        </button>
                        <button type="button" onClick={() => setEditId(null)} disabled={pending} className="h-9 rounded-md border px-3 text-14">
                          Batal
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className={`border-b last:border-b-0 ${r.checked ? "bg-emerald-500/5" : ""}`}>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={r.checked}
                        disabled={pending && busyId === r.id}
                        onChange={(e) => toggle(r.id, e.target.checked)}
                        title={r.checked && r.checkedBy ? `Dicek oleh ${r.checkedBy}` : "Tandai sudah dicek"}
                        className="h-4 w-4 cursor-pointer accent-emerald-600"
                      />
                    </td>
                    <td className="p-3 whitespace-nowrap">{r.tgl}</td>
                    <td className="p-3">{r.category}</td>
                    <td className="p-3">
                      {r.branch}
                      <span className={`block text-12 ${r.source === "KASIR" ? "text-muted-foreground" : "text-sky-600"}`}>{sourceLabel(r.source)}</span>
                    </td>
                    <td className="p-3">{r.description}</td>
                    <td className="p-3">{r.by}</td>
                    <td className="p-3 text-right font-medium whitespace-nowrap">{rupiah(r.amount)}</td>
                    <td className="p-3">
                      {r.photoKey ? (
                        <a href={`/api/file?key=${encodeURIComponent(r.photoKey)}`} target="_blank" rel="noopener" className="text-primary">
                          Lihat
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-3 whitespace-nowrap">
                        <button type="button" onClick={() => openEdit(r)} disabled={editId !== null || pending} className="text-primary disabled:opacity-40">
                          Edit
                        </button>
                        <button type="button" onClick={() => remove(r)} disabled={editId !== null || pending} className="text-destructive disabled:opacity-40">
                          {pending && busyId === r.id ? "…" : "Hapus"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
