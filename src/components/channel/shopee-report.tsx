"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { checkIncomeFile, makeIncomeFile } from "@/server/actions/shopee-finance";

type Kind = "report" | "weekly" | "monthly";
const STATUS: Record<number, string> = { 0: "Tidak valid", 1: "Sedang dibuat…", 2: "Siap diunduh", 3: "Sudah diunduh", 4: "Gagal" };

/** Buat & unduh laporan penghasilan resmi Shopee. */
export function ShopeeReport() {
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<Kind>("report");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState("");
  const [file, setFile] = useState<{ id: string; kind: Kind; status: number; link: string; name: string } | null>(null);

  function make() {
    start(async () => {
      setMsg("");
      const r = await makeIncomeFile(kind, from, to);
      if (!r.ok || !r.id) return setMsg(r.message ?? "Gagal.");
      setFile({ id: r.id, kind, status: 1, link: "", name: "" });
      await poll(kind, r.id);
    });
  }
  async function poll(k: Kind, id: string) {
    for (let i = 0; i < 20; i++) {
      await new Promise((res) => setTimeout(res, 3000));
      const r = await checkIncomeFile(k, id);
      if (!r.ok || !r.file) return setMsg(r.message ?? "Gagal cek status.");
      setFile({ id, kind: k, status: r.file.status, link: r.file.link, name: r.file.name });
      if (r.file.status !== 1) return;
    }
  }

  const field = "h-9 rounded-md border bg-background px-2 text-14";
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Jenis
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={field}>
            <option value="report">Laporan penghasilan (bebas tanggal)</option>
            <option value="weekly">Rekening koran mingguan (Senin–Minggu)</option>
            <option value="monthly">Rekening koran bulanan (tgl 1–akhir bulan)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Dari
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Sampai
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
        </label>
        <button type="button" onClick={make} disabled={pending || !from || !to} className="h-9 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground disabled:opacity-40">
          {pending ? "Membuat…" : "Buat laporan"}
        </button>
      </div>
      {msg && <p className="text-14 text-destructive">{msg}</p>}
      {file && (
        <p className="flex flex-wrap items-center gap-2 text-14">
          <span className="text-muted-foreground">Status:</span> {STATUS[file.status] ?? file.status}
          {file.link && (
            <a href={file.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              <Download className="size-4" /> {file.name || "Unduh"}
            </a>
          )}
        </p>
      )}
    </div>
  );
}
