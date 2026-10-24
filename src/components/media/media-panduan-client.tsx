"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveSettings } from "@/server/actions/media-settings";

export type JobRow = { type: string; label: string; prod: string; tal: string; edit: string };
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const sel = "h-9 rounded-md border bg-background px-2 text-14";

export function MediaPanduanClient({ settings, jobdesk, full }: { settings: { idccDay: number; idccQty: number; idccDays: number }; jobdesk: JobRow[]; full: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [s, setS] = useState(settings);
  const [jobs, setJobs] = useState(jobdesk);

  const setJob = (type: string, k: "prod" | "tal" | "edit", val: string) => setJobs((j) => j.map((r) => (r.type === type ? { ...r, [k]: val } : r)));
  const parse = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean);

  function save() {
    start(async () => {
      const jobdeskObj = Object.fromEntries(jobs.map((r) => [r.type, { prod: parse(r.prod), tal: parse(r.tal), edit: parse(r.edit) }]));
      const r = await saveSettings({ ...s, jobdesk: jobdeskObj });
      if (!r.ok) alert(r.message);
      else {
        alert("Pengaturan disimpan.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <h1 className="text-24 font-semibold">Panduan & Pengaturan</h1>

      <section className="space-y-2 rounded-lg border bg-card p-4 text-14 text-muted-foreground">
        <h2 className="text-14 font-medium text-foreground">Alur kerja</h2>
        <p>Barang lolos QC masuk ke <b>Barang</b> → admin isi kategori + kode Louis1 → <b>Jadwalkan</b> membuat tugas konten (katalog, foto IG, video produk, video review) di <b>Workflow Hub</b>.</p>
        <p>Di Workflow Hub konten bergerak: Terdata → Diproduksi → Editing → Ready → Tayang. Di Ready, tempel link Google Drive file final, admin cek lalu jadwalkan di Meta Business Suite dan tekan "Sudah dijadwalkan di Meta".</p>
        <p>Jadwal syuting/edit/tayang disusun otomatis oleh mesin penjadwalan (kapasitas tim, libur, slot tayang IG 09/12/15/18) dan diseimbangkan setiap papan dibuka.</p>
        <p><b>Analisis IDCC</b>: AI menilai stok lama (stok banyak & umur lama) dan menyarankan konten untuk membantu menjualnya.</p>
      </section>

      {full ? (
        <>
          <section className="space-y-3 rounded-lg border bg-card p-4">
            <h2 className="text-14 font-medium">Pengaturan IDCC</h2>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-12 text-muted-foreground">Hari slot IDCC mingguan</span>
                <select className={sel} value={s.idccDay} onChange={(e) => setS({ ...s, idccDay: Number(e.target.value) })}>
                  {HARI.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-12 text-muted-foreground">Stok minimal (kandidat)</span>
                <Input type="number" className="w-28" value={s.idccQty} onChange={(e) => setS({ ...s, idccQty: Number(e.target.value) })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-12 text-muted-foreground">Umur minimal (hari)</span>
                <Input type="number" className="w-28" value={s.idccDays} onChange={(e) => setS({ ...s, idccDays: Number(e.target.value) })} />
              </label>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border bg-card p-4">
            <h2 className="text-14 font-medium">Jobdesk per jenis konten</h2>
            <p className="text-12 text-muted-foreground">Kode orang dipisah koma (mis. R, Z). Urutan = prioritas (orang pertama utama, sisanya pengganti). Kosongkan untuk pakai bawaan.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-14">
                <thead>
                  <tr className="text-left text-12 text-muted-foreground">
                    <th className="py-1">Jenis</th><th>Produksi</th><th>Talent</th><th>Editing</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((r) => (
                    <tr key={r.type} className="border-t">
                      <td className="py-1 pr-2 font-medium">{r.label}</td>
                      <td className="pr-2"><Input className="w-24" value={r.prod} onChange={(e) => setJob(r.type, "prod", e.target.value)} /></td>
                      <td className="pr-2"><Input className="w-24" value={r.tal} onChange={(e) => setJob(r.type, "tal", e.target.value)} /></td>
                      <td><Input className="w-24" value={r.edit} onChange={(e) => setJob(r.type, "edit", e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <Button disabled={pending} onClick={save}>Simpan pengaturan</Button>
        </>
      ) : (
        <p className="text-14 text-muted-foreground">Pengaturan hanya bisa diubah admin penuh.</p>
      )}
    </div>
  );
}
