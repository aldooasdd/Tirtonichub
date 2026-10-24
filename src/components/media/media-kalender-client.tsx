"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addEvent, updateEvent, deleteEvent, savePcal } from "@/server/actions/media-personal";
import { PCAL_COLORS } from "@/lib/media/card";

type Prod = { date: string; label: string; title: string };
type Post = { date: string; time: string; label: string; title: string; sched: boolean };
type Ev = { id: string; date: string; title: string; time: string | null; color: string; note: string | null };
export type CalData = { prod: Prod[]; post: Post[]; events: Ev[]; pcal: { color: string; notes: string } };

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DOT: Record<string, string> = { lime: "#84cc16", orange: "#f97316", purple: "#a855f7", teal: "#14b8a6", green: "#22c55e", pink: "#ec4899" };
const pad = (n: number) => String(n).padStart(2, "0");

export function MediaKalenderClient({ data, today }: { data: CalData; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ym, setYm] = useState(today.slice(0, 7)); // 'YYYY-MM'
  const [edit, setEdit] = useState<Partial<Ev> | null>(null);
  const [pcalColor, setPcalColor] = useState(data.pcal.color);

  const newEvent = (date: string) => setEdit({ date, color: pcalColor });
  function savePref(color: string, notes: string) {
    start(async () => {
      await savePcal({ color, notes });
      router.refresh();
    });
  }

  const [y, m] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const startDow = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${pad(m)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);

  const prodBy = group(data.prod);
  const postBy = group(data.post);
  const evBy = group(data.events);

  const shift = (n: number) => setYm(`${new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)}`);

  function save(f: Partial<Ev>) {
    if (!f.date || !f.title?.trim()) {
      alert("Tanggal & judul wajib.");
      return;
    }
    start(async () => {
      const payload = { date: f.date!, title: f.title!, time: f.time || null, color: f.color || "lime", note: f.note || null };
      const r = f.id ? await updateEvent(f.id, payload) : await addEvent(payload);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      setEdit(null);
      router.refresh();
    });
  }
  function remove(id: string) {
    if (!confirm("Hapus acara ini?")) return;
    start(async () => {
      const r = await deleteEvent(id);
      if (!r.ok) alert(r.message);
      setEdit(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-24 font-semibold">Kalender</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shift(-1)}>‹</Button>
          <span className="min-w-[150px] text-center font-medium">{BULAN[m - 1]} {y}</span>
          <Button variant="outline" size="sm" onClick={() => shift(1)}>›</Button>
          <Button size="sm" onClick={() => newEvent(today)}>+ Acara</Button>
        </div>
      </div>

      <p className="text-12 text-muted-foreground">Produksi (syuting) & tayang dari Workflow Hub, plus acara pribadimu. Acara pribadi hanya kamu yang lihat.</p>

      <div className="grid grid-cols-7 gap-px rounded-lg border bg-border text-14">
        {HARI.map((h) => (
          <div key={h} className="bg-muted px-2 py-1 text-center text-11 font-medium">{h}</div>
        ))}
        {cells.map((d, i) => (
          <div key={i} className={`min-h-[86px] bg-card p-1 ${d === today ? "ring-2 ring-primary ring-inset" : ""}`}>
            {d && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-11 text-muted-foreground">{Number(d.slice(8))}</span>
                  <button className="text-11 text-muted-foreground hover:text-foreground" onClick={() => newEvent(d)} title="Tambah acara">＋</button>
                </div>
                <div className="space-y-0.5">
                  {(postBy[d] || []).map((p, j) => (
                    <div key={"p" + j} className={`truncate rounded px-1 text-10 ${p.sched ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`} title={`Tayang ${p.label}: ${p.title}`}>
                      {p.time ? p.time.replace(":", ".") : ""} {p.label}
                    </div>
                  ))}
                  {(prodBy[d] || []).map((p, j) => (
                    <div key={"s" + j} className="truncate rounded bg-amber-100 px-1 text-10 text-amber-800" title={`Syuting: ${p.title}`}>🎬 {p.label}</div>
                  ))}
                  {(evBy[d] || []).map((e) => (
                    <button key={e.id} className="flex w-full items-center gap-1 truncate rounded px-1 text-left text-10 hover:bg-muted" onClick={() => setEdit(e)} title={e.note || e.title}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: DOT[e.color] || DOT.lime }} />
                      {e.time ? e.time.replace(":", ".") : ""} {e.title}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <section className="space-y-2 rounded-lg border bg-card p-4">
        <h2 className="text-14 font-medium">Catatan pribadi</h2>
        <textarea className="w-full rounded-md border bg-background p-2 text-14" rows={3} defaultValue={data.pcal.notes} maxLength={5000}
          placeholder="Catatan hanya kamu yang lihat" onBlur={(e) => e.target.value !== data.pcal.notes && savePref(pcalColor, e.target.value)} />
        <div className="flex items-center gap-2">
          <span className="text-12 text-muted-foreground">Warna default acara baru:</span>
          {PCAL_COLORS.map((c) => (
            <button key={c} onClick={() => { setPcalColor(c); savePref(c, data.pcal.notes); }}
              className={`h-6 w-6 rounded-full ${pcalColor === c ? "ring-2 ring-offset-1 ring-foreground" : ""}`} style={{ background: DOT[c] }} title={c} />
          ))}
        </div>
      </section>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEdit(null)}>
          <div className="w-full max-w-sm space-y-3 rounded-lg bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-medium">{edit.id ? "Ubah acara" : "Acara baru"}</h2>
            <label className="block space-y-1">
              <span className="text-12 text-muted-foreground">Judul</span>
              <Input defaultValue={edit.title ?? ""} onChange={(e) => (edit.title = e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-12 text-muted-foreground">Tanggal</span>
                <Input type="date" defaultValue={edit.date} onChange={(e) => (edit.date = e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-12 text-muted-foreground">Jam (opsional)</span>
                <Input type="time" defaultValue={edit.time ?? ""} onChange={(e) => (edit.time = e.target.value)} />
              </label>
            </div>
            <div className="space-y-1">
              <span className="text-12 text-muted-foreground">Warna</span>
              <div className="flex gap-2">
                {PCAL_COLORS.map((c) => (
                  <button key={c} onClick={() => setEdit({ ...edit, color: c })} className={`h-7 w-7 rounded-full ${edit.color === c ? "ring-2 ring-offset-1 ring-foreground" : ""}`} style={{ background: DOT[c] }} title={c} />
                ))}
              </div>
            </div>
            <label className="block space-y-1">
              <span className="text-12 text-muted-foreground">Catatan (opsional)</span>
              <Input defaultValue={edit.note ?? ""} onChange={(e) => (edit.note = e.target.value)} />
            </label>
            <div className="flex gap-2">
              <Button disabled={pending} onClick={() => save(edit)}>Simpan</Button>
              {edit.id && <Button variant="outline" disabled={pending} onClick={() => remove(edit.id!)}>Hapus</Button>}
              <Button variant="outline" disabled={pending} onClick={() => setEdit(null)}>Batal</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function group<T extends { date: string }>(arr: T[]): Record<string, T[]> {
  const m: Record<string, T[]> = {};
  arr.forEach((x) => (m[x.date] = m[x.date] || []).push(x));
  return m;
}
