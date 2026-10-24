"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  STAGES, IDX, POSTED, TYPES, CATLBL, GENDERS, SLOT_TIMES, kindOf, PEOPLE, NAMES, nm, HAS_TALENT, HAS_SCRIPT,
} from "@/lib/media/schedule";
import { deadlineFor, fileName, mine, canMove, late, MEMBER_STAGES, REASONS } from "@/lib/media/card";
import type { Task } from "@/lib/media/schedule";
import { setTaskStatus, updateTask, toggleCheck, markMeta, deleteTask, generateCaption } from "@/server/actions/media-tasks";

export type WfTask = {
  id: string; itemId: string | null; type: string; title: string; cat: string | null; gender: string | null;
  status: string; source: string | null; reason: string | null;
  producer: string | null; editor: string | null; talent: string | null; script: string | null;
  shootPlan: string | null; editPlan: string | null; postAt: string | null; postTime: string | null; postTimeAuto: string;
  due: string | null; shotAt: string | null; readyAt: string | null;
  locked: boolean; checked: boolean; meta: boolean; driveUrl: string | null; caption: string | null; srcDesc: string | null; note: string | null;
  fileDue: string; history: { at: number; name?: string; from?: string; to?: string }[]; createdAt: number;
};

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function fmt(s: string | null | undefined) {
  if (!s) return "-";
  const d = new Date(s + "T00:00:00Z");
  return `${HARI[d.getUTCDay()]} ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}`;
}
const fmtTime = (t?: string | null) => (t ? t.replace(":", ".") : "");
// WfTask → Task util
const asTask = (t: WfTask): Task => ({ ...t, metaAt: t.meta ? 1 : 0 });

const STAGE_SUB: Record<string, string> = {
  Terdata: "Masuk pantauan", Diproduksi: "Sedang syuting", Editing: "Sedang diedit", Ready: "File final di Drive", Tayang: "Sudah di Instagram",
};

export function WorkflowClient({ tasks, canManage, code, today }: { tasks: WfTask[]; canManage: boolean; code: string | null; today: string }) {
  const [onlyMine, setOnlyMine] = useState(false);
  const view = canManage && !onlyMine ? null : code;
  const shown = tasks.filter((t) => (canManage && !onlyMine ? true : mine(asTask(t), code)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-24 font-semibold">Workflow Hub</h1>
        {canManage && (
          <div className="flex gap-1 text-14">
            <button className={`rounded-md border px-3 py-1 ${!onlyMine ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setOnlyMine(false)}>Semua</button>
            <button className={`rounded-md border px-3 py-1 ${onlyMine ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setOnlyMine(true)}>Tugas saya</button>
          </div>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:overflow-visible">
        {STAGES.map((stage) => {
          const col = shown.filter((t) => t.status === stage);
          return (
            <div key={stage} className="min-w-[270px] flex-1 space-y-2">
              <div className="sticky top-0 rounded-md bg-muted px-3 py-2">
                <p className="text-14 font-medium">{stage} <span className="text-muted-foreground">({col.length})</span></p>
                <p className="text-11 text-muted-foreground">{STAGE_SUB[stage]}</p>
              </div>
              {col.map((t) => (
                <Card key={t.id} t={t} canManage={canManage} code={code} today={today} view={view} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({ t, canManage, code, today, view }: { t: WfTask; canManage: boolean; code: string | null; today: string; view: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) alert(r.message);
      router.refresh();
    });

  const tt = asTask(t);
  const movable = canMove(tt, canManage, code, today);
  const dl = deadlineFor(tt, today, view);
  const isLate = late(tt, today);
  const postTime = t.postTime || t.postTimeAuto;

  const dlRel = (() => {
    if (!dl?.d) return "";
    const n = Math.round((Date.parse(dl.d) - Date.parse(today)) / 864e5);
    return n < 0 ? `terlambat ${-n} hari` : n === 0 ? "hari ini" : n === 1 ? "besok" : "";
  })();

  return (
    <article className={`space-y-2 rounded-lg border bg-card p-3 ${isLate ? "border-red-400" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-11 font-medium text-muted-foreground">{TYPES[t.type]?.label ?? t.type}</span>
        {dl?.d && (
          <span className={`text-11 ${dl.info ? "text-green-600" : dlRel.startsWith("terlambat") ? "text-red-600" : "text-muted-foreground"}`}>
            {dl.lbl}{view === null && dl.who ? ` · ${nm(dl.who)}` : ""} · {fmt(dl.d)}{dlRel ? ` (${dlRel})` : ""}
          </span>
        )}
      </div>
      <p className="font-medium leading-tight">{t.title}</p>
      <div className="flex flex-wrap gap-1 text-11">
        {t.cat && <span className="rounded bg-muted px-1.5 py-0.5">{CATLBL[t.cat] ?? t.cat}</span>}
        {t.gender && GENDERS[t.gender] && <span className="rounded bg-muted px-1.5 py-0.5">{GENDERS[t.gender]}</span>}
        {t.source === "lama" && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">{REASONS[t.reason ?? ""]?.short ?? "Stok lama"}</span>}
        {t.driveUrl && <a href={t.driveUrl} target="_blank" rel="noopener" className="rounded bg-green-100 px-1.5 py-0.5 text-green-800">File Drive</a>}
        {t.fileDue && <span className={`rounded px-1.5 py-0.5 ${t.fileDue < today ? "bg-red-100 text-red-700" : "bg-muted"}`}>Deadline {fmt(t.fileDue)}</span>}
      </div>

      {/* orang */}
      <div className="flex flex-wrap gap-1 text-11">
        {(["producer", "editor", "talent", "script"] as const).filter((k) => t[k]).map((k) => (
          <span key={k} className={`rounded px-1.5 py-0.5 ${t[k] === code ? "bg-primary/15 font-medium" : "bg-muted"}`}>
            {({ producer: "Prod", editor: "Edit", talent: "Talent", script: "Skrip" } as Record<string, string>)[k]}: {nm(t[k]!)}
          </span>
        ))}
      </div>

      {/* stepper tahap */}
      <div className="flex gap-1">
        {STAGES.map((s, i) => {
          const ci = IDX[t.status];
          const ok = movable && s !== t.status && (canManage || MEMBER_STAGES.includes(s));
          return (
            <button key={s} type="button" disabled={!ok || pending} onClick={() => run(() => setTaskStatus(t.id, s))}
              className={`flex-1 rounded px-1 py-1 text-10 ${i === ci ? "bg-primary text-primary-foreground" : i < ci ? "bg-primary/20" : "bg-muted"} disabled:opacity-50`}
              title={s}>
              {s === "Diproduksi" ? "Produksi" : s === "Editing" ? "Edit" : s}
            </button>
          );
        })}
      </div>

      {/* flag check/meta di Ready */}
      {t.status === "Ready" && POSTED.includes(t.type) && (
        <div className="flex flex-wrap items-center gap-2 text-11">
          {canManage && !t.meta ? (
            <button className={`rounded border px-2 py-1 ${t.checked ? "bg-green-100 text-green-800" : ""}`} disabled={pending} onClick={() => run(() => toggleCheck(t.id))}>
              {t.checked ? "✓ Dicek Zaki" : "Tandai sudah dicek"}
            </button>
          ) : t.checked ? <span className="text-green-700">✓ Dicek Zaki</span> : null}
          {t.meta ? (
            <span className="rounded bg-green-100 px-2 py-1 text-green-800">Terjadwal di Meta · {fmt(t.postAt)} {fmtTime(postTime)}</span>
          ) : canManage && t.postAt && postTime ? (
            <button className="rounded bg-primary px-2 py-1 text-primary-foreground" disabled={pending} onClick={() => run(() => markMeta(t.id))}>
              Sudah dijadwalkan di Meta ({fmt(t.postAt)} {fmtTime(postTime)})
            </button>
          ) : null}
        </div>
      )}

      {/* detail */}
      <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-12 text-muted-foreground">Detail</summary>
        <div className="mt-2 space-y-2">
          {canManage ? (
            <AdminFields t={t} pending={pending} run={run} />
          ) : (
            <p className="text-12 text-muted-foreground">
              {IDX[t.status] <= 0 && t.shootPlan ? `Syuting ${fmt(t.shootPlan)} · ` : ""}
              {IDX[t.status] < IDX["Ready"] ? `Edit selesai ${fmt(t.due || t.editPlan)} · ` : ""}
              {t.postAt ? `Tayang ${fmt(t.postAt)}${postTime ? ` pukul ${fmtTime(postTime)}` : ""}` : ""}
            </p>
          )}

          {/* note & driveUrl: admin atau pemilik */}
          {(canManage || (mine(tt, code) && !t.meta)) && (
            <>
              <label className="block space-y-1">
                <span className="text-11 text-muted-foreground">Catatan / kendala</span>
                <textarea className="w-full rounded-md border bg-background p-2 text-14" rows={2} defaultValue={t.note ?? ""} maxLength={1000}
                  onBlur={(e) => e.target.value !== (t.note ?? "") && run(() => updateTask(t.id, { note: e.target.value }))} />
              </label>
              {POSTED.includes(t.type) && (
                <label className="block space-y-1">
                  <span className="text-11 text-muted-foreground">Link file final (Google Drive)</span>
                  <Input type="url" defaultValue={t.driveUrl ?? ""} placeholder="https://drive.google.com/…"
                    onBlur={(e) => e.target.value !== (t.driveUrl ?? "") && run(() => updateTask(t.id, { driveUrl: e.target.value }))} />
                </label>
              )}
            </>
          )}

          {canManage && POSTED.includes(t.type) && <CaptionBox t={t} />}

          <div className="flex items-center gap-2 text-11 text-muted-foreground">
            <code className="truncate rounded bg-muted px-1.5 py-0.5">{fileName(tt)}</code>
          </div>

          {t.history.length > 0 && (
            <details className="text-11 text-muted-foreground">
              <summary className="cursor-pointer">Riwayat status ({t.history.length})</summary>
              <ul className="mt-1 space-y-0.5">
                {t.history.slice().reverse().map((h, idx) => (
                  <li key={idx}>{new Date(h.at).toLocaleString("id-ID")} · <b>{h.name || "-"}</b>: {h.from || "-"} → {h.to}</li>
                ))}
              </ul>
            </details>
          )}

          {canManage && (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => confirm("Hapus konten ini?") && run(() => deleteTask(t.id))}>
              Hapus konten
            </Button>
          )}
        </div>
      </details>
    </article>
  );
}

function CaptionBox({ t }: { t: WfTask }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [src, setSrc] = useState(t.srcDesc ?? "");
  const [caption, setCaption] = useState(t.caption ?? "");
  const [msg, setMsg] = useState("");

  function gen() {
    if (src.trim().length < 20) {
      setMsg("Tempel deskripsi barang dari toko online (min. 1-2 kalimat).");
      return;
    }
    setMsg("AI menulis caption…");
    start(async () => {
      const r = await generateCaption(t.id, src);
      if (!r.ok) {
        setMsg(r.message ?? "Gagal.");
        return;
      }
      setCaption(r.caption ?? "");
      setMsg("");
      router.refresh();
    });
  }
  return (
    <details className="rounded-md border p-2">
      <summary className="cursor-pointer text-12">Caption Instagram {caption ? <span className="text-green-600">· siap</span> : <span className="text-muted-foreground">· belum</span>}</summary>
      <div className="mt-2 space-y-2">
        <label className="block space-y-1">
          <span className="text-11 text-muted-foreground">Deskripsi barang dari toko online</span>
          <textarea className="w-full rounded-md border bg-background p-2 text-14" rows={3} value={src} maxLength={4000} onChange={(e) => setSrc(e.target.value)} placeholder="Tempel deskripsi produk" />
        </label>
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={pending} onClick={gen}>{caption ? "Buat ulang" : "Buat caption AI"}</Button>
          {msg && <span className="text-11 text-muted-foreground">{msg}</span>}
        </div>
        {caption && (
          <label className="block space-y-1">
            <span className="text-11 text-muted-foreground">Caption final</span>
            <textarea className="w-full rounded-md border bg-background p-2 text-14" rows={6} value={caption} maxLength={2200} onChange={(e) => setCaption(e.target.value)} />
            <button type="button" className="text-11 text-primary" onClick={() => navigator.clipboard?.writeText(caption)}>Salin caption</button>
          </label>
        )}
      </div>
    </details>
  );
}

function AdminFields({ t, pending, run }: { t: WfTask; pending: boolean; run: (fn: () => Promise<{ ok: boolean; message?: string }>) => void }) {
  const sel = "h-9 w-full rounded-md border bg-background px-2 text-14";
  const person = (k: "producer" | "editor" | "talent" | "script", none: boolean) => (
    <label className="block space-y-1">
      <span className="text-11 text-muted-foreground">{({ producer: "Produksi", editor: "Editing", talent: "Talent", script: "Skrip" } as Record<string, string>)[k]}</span>
      <select className={sel} value={t[k] ?? ""} disabled={pending} onChange={(e) => run(() => updateTask(t.id, { [k]: e.target.value || null }))}>
        {none && <option value="">-</option>}
        {PEOPLE.map((p) => <option key={p} value={p}>{NAMES[p]}</option>)}
      </select>
    </label>
  );
  const dateF = (k: "shootPlan" | "editPlan" | "postAt", label: string) => (
    <label className="block space-y-1">
      <span className="text-11 text-muted-foreground">{label}</span>
      <Input type="date" defaultValue={t[k] ?? ""} disabled={pending} onChange={(e) => run(() => updateTask(t.id, { [k]: e.target.value || null }))} />
    </label>
  );
  const showPost = POSTED.includes(t.type);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {person("producer", false)}
        {person("editor", false)}
        {(HAS_TALENT(t.type) || t.talent) && person("talent", true)}
        {(HAS_SCRIPT(t.type) || t.script) && person("script", true)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {IDX[t.status] <= 0 && dateF("shootPlan", "Rencana syuting")}
        {IDX[t.status] < IDX["Ready"] && dateF("editPlan", "Rencana edit")}
        {showPost && dateF("postAt", "Tanggal tayang")}
        {showPost && (
          <label className="block space-y-1">
            <span className="text-11 text-muted-foreground">Jam tayang</span>
            <select className={sel} value={t.postTime ?? ""} disabled={pending} onChange={(e) => run(() => updateTask(t.id, { postTime: e.target.value || null }))}>
              <option value="">Otomatis{t.postTimeAuto ? ` (${fmtTime(t.postTimeAuto)})` : ""}</option>
              {SLOT_TIMES[kindOf(t.type)].map((x) => <option key={x} value={x}>{fmtTime(x)}</option>)}
            </select>
          </label>
        )}
      </div>
      {IDX[t.status] < IDX["Ready"] && (
        <label className="flex items-center gap-2 text-12">
          <input type="checkbox" defaultChecked={t.locked} disabled={pending} onChange={(e) => run(() => updateTask(t.id, { locked: e.target.checked }))} />
          Kunci jadwal (tidak dipindah otomatis)
        </label>
      )}
    </div>
  );
}
