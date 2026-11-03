"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compressImage } from "@/lib/image";
import { fmtInt, parseInt0 } from "@/lib/money-input";
import { saveCashDeposit } from "@/server/actions/cash-deposit";

export type SetorRow = { id: string; tgl: string; branch: string; by: string; amount: number; photoKey: string };
type Branch = { id: string; name: string };

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;
const nowLocal = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 16); // WIB

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

/** Form setor tunai Kepala Cabang + riwayat. branches hanya untuk Boss/Admin (pilih cabang). */
export function SetorTunaiForm({ rows, akun, branches, defaultBranchId }: { rows: SetorRow[]; akun: string; branches: Branch[] | null; defaultBranchId: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState(0);
  const [at, setAt] = useState(nowLocal);
  const [branchId, setBranchId] = useState(defaultBranchId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setMsg(null);
    if (amount <= 0) return setMsg({ ok: false, text: "Isi nominal setor." });
    if (!file) return setMsg({ ok: false, text: "Upload bukti setor." });
    setBusy(true);
    try {
      const isPdf = file.type === "application/pdf";
      const b64 = await blobToBase64(isPdf ? file : await compressImage(file, 1600, 0.8));
      const r = await saveCashDeposit({ amount, depositedAt: at, branchId: branchId || null, imageBase64: b64, mimeType: isPdf ? "application/pdf" : "image/jpeg" });
      if (!r.ok) return setMsg({ ok: false, text: r.message ?? "Gagal simpan." });
      setMsg({ ok: true, text: "Setor tunai tersimpan. Cash laci kasir sudah dikurangi." });
      setAmount(0);
      setFile(null);
      setAt(nowLocal());
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Gagal simpan. Muat ulang halaman lalu coba lagi." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-24 font-semibold">Setor Tunai</h1>
        <p className="text-14 text-muted-foreground">
          Setor cash laci kasir ke rekening <span className="font-medium text-foreground">{akun}</span>. Nominal langsung mengurangi cash di Saldo Kasir.
        </p>
      </div>

      <div className="max-w-md space-y-3 rounded-lg border bg-card p-4">
        {branches && (
          <label className="block space-y-1">
            <span className="block text-12 text-muted-foreground">Cabang</span>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-14">
              <option value="">Pilih cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block space-y-1">
          <span className="block text-12 text-muted-foreground">Nominal (Rp)</span>
          <Input inputMode="numeric" value={fmtInt(amount)} onChange={(e) => setAmount(parseInt0(e.target.value))} placeholder="0" />
        </label>
        <label className="block space-y-1">
          <span className="block text-12 text-muted-foreground">Tanggal & jam setor</span>
          <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="block text-12 text-muted-foreground">Bukti setor (foto / PDF)</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-14 file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5"
          />
        </label>
        <Button onClick={submit} disabled={busy} className="w-full">
          {busy ? "Menyimpan…" : "Simpan Setor Tunai"}
        </Button>
        {msg && <p className={msg.ok ? "text-14 text-emerald-600" : "text-14 text-destructive"}>{msg.text}</p>}
      </div>

      <div className="space-y-2">
        <h2 className="text-14 font-semibold">Riwayat setor</h2>
        {rows.length === 0 ? (
          <p className="text-14 text-muted-foreground">Belum ada setoran.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-14">
              <thead>
                <tr className="border-b bg-card text-left text-muted-foreground">
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Cabang</th>
                  <th className="p-3">Kepala Cabang</th>
                  <th className="p-3 text-right">Nominal</th>
                  <th className="p-3">Bukti</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="p-3 whitespace-nowrap">{r.tgl}</td>
                    <td className="p-3">{r.branch}</td>
                    <td className="p-3">{r.by}</td>
                    <td className="p-3 text-right font-medium whitespace-nowrap">{rupiah(r.amount)}</td>
                    <td className="p-3">
                      <a href={`/api/file?key=${encodeURIComponent(r.photoKey)}`} target="_blank" rel="noopener" className="text-primary">
                        Lihat
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
