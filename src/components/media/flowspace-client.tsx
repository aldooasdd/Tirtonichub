"use client";
// FlowSpace versi baru (ala Attio): Board (Kanban, tarik-lepas antar tahap) & Table (TanStack: urut, kolom, halaman),
// pencarian ⌘K, filter, tampilan tersimpan di database, panel detail di kanan. Semua perubahan lewat server action
// yang sudah ada (media-tasks.ts) sehingga aturan tahap, brief, Creative Review, dan izin tetap sama dengan Studio.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState, type VisibilityState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Bookmark, Columns3, ExternalLink, Kanban, Search, Table2, X, AlertTriangle, CheckCircle2, Clock, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { setTaskStatus, updateTask } from "@/server/actions/media-tasks";
import { saveFsViews } from "@/server/actions/flowspace";
import { applyFilter, boardColumns, FS_EMPTY, type FsFilter, type FsTask, type FsView } from "@/lib/media/flowspace";

const STAGES = ["Terdata", "Diproduksi", "Editing", "Ready", "Tayang"];
const STAGE_C: Record<string, string> = { Terdata: "#546E7A", Diproduksi: "#FB8C00", Editing: "#8E24AA", Ready: "#1E88E5", Tayang: "#43A047" };
const TYPE_C: Record<string, string> = { ktl: "#3F51B5", igf: "#E91E63", vpr: "#00ACC1", vrv: "#1F3A8A", idf: "#C9A400", idc: "#795548", evt: "#9E9D24", khs: "#6D4C41", cmp: "#546E7A" };
const BRIEF: Record<string, [string, string]> = { none: ["—", "text-[#73777F]"], draft: ["Draf", "text-[#73777F]"], submitted: ["Menunggu", "text-amber-700"], approved: ["Disetujui", "text-emerald-700"], revisi: ["Revisi", "text-red-600"] };
const REVIEW: Record<string, [string, string]> = { none: ["—", "text-[#73777F]"], submitted: ["Menunggu review", "text-amber-700"], revision: ["Revision", "text-amber-700"], major: ["Major revision", "text-red-600"], blocked: ["Blocked", "text-red-600"], approved: ["Approved", "text-emerald-700"], reopened: ["Dibuka ulang", "text-amber-700"] };
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const fmt = (d: string) => (d ? Number(d.slice(8)) + " " + BULAN[Number(d.slice(5, 7)) - 1] : "");
/** Bila halaman ini tertanam di Studio (iframe), buka Detail kartu di Studio induk tanpa memuat ulang. */
function openScriptInStudio(e: React.MouseEvent, id: string) {
  if (typeof window !== "undefined" && window.parent !== window) {
    e.preventDefault();
    window.parent.postMessage({ type: "ts-open-script", id }, window.location.origin);
  }
}
const scriptLink = (id: string) => "/studio/?p=script&card=" + encodeURIComponent(id);
function openInStudio(e: React.MouseEvent, id: string, tab: string) {
  if (typeof window !== "undefined" && window.parent !== window) {
    e.preventDefault();
    window.parent.postMessage({ type: "ts-open-card", id, tab }, window.location.origin);
  }
}
const studioLink = (id: string, tab = "det") => "/studio/?p=pipeline&card=" + encodeURIComponent(id) + "&tab=" + tab;

type Props = { tasks: FsTask[]; names: Record<string, string>; people: string[]; types: Record<string, string>; today: string; canManage: boolean; full: boolean; code: string | null; initialViews: FsView[] };

function Avatar({ code, names }: { code: string; names: Record<string, string> }) {
  if (!code) return null;
  return <span title={names[code] ?? code} className="grid size-5 place-items-center rounded-full border border-[#E7E9EC] bg-[#F3F4F6] text-[10px] font-semibold text-[#202124]">{(names[code] ?? code).slice(0, 1)}</span>;
}
function TypeDot({ type, types }: { type: string; types: Record<string, string> }) {
  return <span className="inline-flex items-center gap-1.5 text-[12px] text-[#73777F]"><span className="size-2 rounded-full" style={{ background: TYPE_C[type] ?? "#999" }} />{types[type] ?? type}</span>;
}
const chip = (on: boolean) => "rounded-md border px-2 py-1 text-[12.5px] " + (on ? "border-[#2F6FEB] bg-[#2F6FEB]/10 text-[#2F6FEB]" : "border-[#E7E9EC] bg-white text-[#202124] hover:bg-[#F8F9FA]");

export function FlowspaceClient({ tasks, names, people, types, today, canManage, full, code, initialViews }: Props) {
  const router = useRouter();
  // perubahan tahap yang baru dikirim ditampilkan dulu (optimistis); dibatalkan bila server menolak
  const [over, setOver] = useState<Record<string, string>>({});
  const data = useMemo(() => tasks.map((t) => (over[t.id] && over[t.id] !== t.status ? { ...t, status: over[t.id] } : t)), [tasks, over]);
  const [view, setView] = useState<"board" | "table">("board");
  const [f, setF] = useState<FsFilter>({ ...FS_EMPTY, people: full || !code ? [] : [code] });
  const [sorting, setSorting] = useState<SortingState>([{ id: "deadline", desc: false }]);
  const [hidden, setHidden] = useState<VisibilityState>({ script: false, talent: false, editPlan: false });
  const [views, setViews] = useState<FsView[]>(initialViews);
  const [activeView, setActiveView] = useState<string>("");
  const [selId, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);
  const rows = useMemo(() => applyFilter(data, f, names, today), [data, f, names, today]);
  const sel = data.find((t) => t.id === selId) ?? null;

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === "Escape" && selId) setSel(null);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [selId]);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 5000); return () => clearTimeout(t); } }, [msg]);

  /** Pindah tahap lewat server action yang sama dengan dasbor; tampilan diperbarui dulu lalu dikembalikan bila ditolak. */
  const move = (t: FsTask, stage: string) => {
    if (stage === t.status) return;
    setOver((o) => ({ ...o, [t.id]: stage }));
    start(async () => {
      const r = await setTaskStatus(t.id, stage);
      if (!r.ok) { setOver((o) => { const n = { ...o }; delete n[t.id]; return n; }); setMsg({ t: r.message ?? "Tidak bisa dipindah.", bad: true }); }
      else { setMsg({ t: "Dipindah ke " + stage + ": " + t.title }); router.refresh(); }
    });
  };
  const patch = (t: FsTask, p: Parameters<typeof updateTask>[1], label: string) =>
    start(async () => { const r = await updateTask(t.id, p); setMsg(r.ok ? { t: label } : { t: r.message ?? "Gagal menyimpan.", bad: true }); if (r.ok) router.refresh(); });

  const columns = useMemo<ColumnDef<FsTask>[]>(() => [
    { id: "title", header: "Konten", accessorFn: (t) => t.title, cell: ({ row: { original: t } }) => (
      <div className="flex min-w-[220px] items-center gap-2.5">
        {t.thumb ? <img src={t.thumb} alt="" className="size-8 shrink-0 rounded-md border border-[#E7E9EC] object-cover" /> : <span className="size-8 shrink-0 rounded-md border border-[#E7E9EC] bg-[#F3F4F6]" />}
        <div className="min-w-0"><p className="truncate font-medium text-[#202124]">{t.title}</p><TypeDot type={t.type} types={types} /></div>
      </div>) },
    { id: "cprId", header: "Content ID", accessorFn: (t) => t.cprId, cell: ({ getValue }) => <span className="font-mono text-[11px] text-[#73777F]">{String(getValue() || "—")}</span> },
    { id: "status", header: "Tahap", accessorFn: (t) => STAGES.indexOf(t.status), cell: ({ row: { original: t } }) => <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E7E9EC] px-1.5 py-0.5 text-[12px]"><span className="size-2 rounded-full" style={{ background: STAGE_C[t.status] }} />{t.status}{t.meta ? " · Meta" : ""}</span> },
    { id: "producer", header: "PIC Produksi", accessorFn: (t) => names[t.producer] ?? t.producer },
    { id: "editor", header: "PIC Editing", accessorFn: (t) => names[t.editor] ?? t.editor },
    { id: "talent", header: "Talent", accessorFn: (t) => names[t.talent] ?? t.talent },
    { id: "script", header: "Skrip", accessorFn: (t) => names[t.script] ?? t.script },
    { id: "deadline", header: "Deadline Ready", accessorFn: (t) => t.deadline || "9999", cell: ({ row: { original: t } }) => t.deadline ? <span className={t.late ? "font-medium text-red-600" : ""}>{fmt(t.deadline)}{t.late ? " · terlambat" : ""}</span> : <span className="text-[#73777F]">—</span> },
    { id: "shootPlan", header: "Rencana syuting", accessorFn: (t) => t.shootPlan || "9999", cell: ({ row: { original: t } }) => fmt(t.shootPlan) || "—" },
    { id: "editPlan", header: "Rencana edit", accessorFn: (t) => t.editPlan || "9999", cell: ({ row: { original: t } }) => fmt(t.editPlan) || "—" },
    { id: "postAt", header: "Jadwal tayang", accessorFn: (t) => t.postAt || "9999", cell: ({ row: { original: t } }) => (t.postAt ? fmt(t.postAt) + (t.postTime ? " " + t.postTime.replace(":", ".") : "") : "—") },
    { id: "brief", header: "Brief", accessorFn: (t) => t.brief, cell: ({ row: { original: t } }) => <span className={BRIEF[t.brief][1]}>{BRIEF[t.brief][0]}</span> },
    { id: "review", header: "Creative Review", accessorFn: (t) => t.review, cell: ({ row: { original: t } }) => <span className={REVIEW[t.review]?.[1]}>{REVIEW[t.review]?.[0] ?? t.review}</span> },
  ], [names, types]);
  const table = useReactTable({ data: rows, columns, state: { sorting, columnVisibility: hidden }, onSortingChange: setSorting, onColumnVisibilityChange: setHidden, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize: 50 } } });

  const applyView = (v: FsView | null) => {
    setActiveView(v?.id ?? "");
    if (!v) { setF({ ...FS_EMPTY, people: full || !code ? [] : [code] }); return; }
    setView(v.view); setF(v.filter); setSorting(v.sort); setHidden(Object.fromEntries(v.hidden.map((h) => [h, false])));
  };
  const saveView = () => {
    const name = prompt("Nama tampilan (mis. Review minggu ini):")?.trim();
    if (!name) return;
    const v: FsView = { id: "v" + Date.now().toString(36), name: name.slice(0, 40), view, filter: f, sort: sorting.slice(0, 3), hidden: Object.entries(hidden).filter(([, on]) => !on).map(([k]) => k) };
    const next = [...views, v];
    start(async () => { const r = await saveFsViews(next); if (r.ok) { setViews(next); setActiveView(v.id); setMsg({ t: "Tampilan disimpan." }); } else setMsg({ t: r.message, bad: true }); });
  };
  const delView = (id: string) => start(async () => { const next = views.filter((v) => v.id !== id); const r = await saveFsViews(next); if (r.ok) { setViews(next); if (activeView === id) applyView(null); } });
  const toggle = (k: "types" | "people" | "stages", v: string) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));

  // navigasi keyboard di tabel: j/k pilih, Enter buka panel
  const tRows = table.getRowModel().rows;
  const onTableKey = (e: React.KeyboardEvent) => {
    const i = tRows.findIndex((r) => r.original.id === selId);
    if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setSel(tRows[Math.min(tRows.length - 1, i + 1)]?.original.id ?? null); }
    if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setSel(tRows[Math.max(0, i - 1)]?.original.id ?? null); }
  };

  return (
    <div className={"grid gap-3 p-4 text-[#202124] md:p-6 " + (sel ? "lg:pr-[436px]" : "")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[12px] font-medium text-[#73777F]">Media · Produksi</p><h1 className="text-[22px] font-semibold tracking-tight">FlowSpace</h1></div>
        <div className="flex items-center gap-1 rounded-lg border border-[#E7E9EC] bg-white p-0.5">
          {([["board", "Board", Kanban], ["table", "Table", Table2]] as const).map(([k, l, I]) => <button key={k} onClick={() => setView(k)} aria-pressed={view === k} className={"flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] " + (view === k ? "bg-[#F3F4F6] font-medium" : "text-[#73777F]")}><I className="size-3.5" />{l}</button>)}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button className={chip(!activeView)} onClick={() => applyView(null)}>Semua</button>
        {views.map((v) => <span key={v.id} className="inline-flex items-center"><button className={chip(activeView === v.id)} onClick={() => applyView(v)}><Bookmark className="mr-1 inline size-3" />{v.name}</button><button aria-label={"Hapus tampilan " + v.name} onClick={() => delView(v.id)} className="ml-0.5 rounded p-0.5 text-[#73777F] hover:bg-[#F3F4F6]"><X className="size-3" /></button></span>)}
        <Button variant="ghost" size="sm" onClick={saveView} disabled={pending}>+ Simpan tampilan</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E7E9EC] bg-white px-3 py-2">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-[#E7E9EC] px-2 focus-within:border-[#2F6FEB]">
          <Search className="size-3.5 text-[#73777F]" />
          <input ref={searchRef} value={f.q} onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))} placeholder="Cari judul, Content ID, PIC, kategori…" className="h-8 flex-1 bg-transparent text-[13px] outline-none" aria-label="Cari kartu" />
          <kbd className="rounded border border-[#E7E9EC] px-1 text-[10px] text-[#73777F]">⌘K</kbd>
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" size="sm">Jenis{f.types.length ? " · " + f.types.length : ""}</Button></DropdownMenuTrigger>
          <DropdownMenuContent>{Object.entries(types).map(([k, l]) => <DropdownMenuCheckboxItem key={k} checked={f.types.includes(k)} onCheckedChange={() => toggle("types", k)} onSelect={(e) => e.preventDefault()}>{l}</DropdownMenuCheckboxItem>)}</DropdownMenuContent>
        </DropdownMenu>
        {view === "table" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm">Tahap{f.stages.length ? " · " + f.stages.length : ""}</Button></DropdownMenuTrigger>
            <DropdownMenuContent>{STAGES.map((s) => <DropdownMenuCheckboxItem key={s} checked={f.stages.includes(s)} onCheckedChange={() => toggle("stages", s)} onSelect={(e) => e.preventDefault()}>{s}</DropdownMenuCheckboxItem>)}</DropdownMenuContent>
          </DropdownMenu>
        )}
        <div className="flex items-center gap-1">{people.map((p) => <button key={p} className={chip(f.people.includes(p))} onClick={() => toggle("people", p)}>{names[p] ?? p}</button>)}</div>
        <button className={chip(f.lateOnly)} onClick={() => setF((x) => ({ ...x, lateOnly: !x.lateOnly }))}><AlertTriangle className="mr-1 inline size-3" />Terlambat</button>
        <button className={chip(f.showTayang)} onClick={() => setF((x) => ({ ...x, showTayang: !x.showTayang }))}>Tayang lama</button>
        {view === "table" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Columns3 />Kolom</Button></DropdownMenuTrigger>
            <DropdownMenuContent><DropdownMenuLabel>Tampilkan kolom</DropdownMenuLabel><DropdownMenuSeparator />
              {table.getAllLeafColumns().filter((c) => c.id !== "title").map((c) => <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)} onSelect={(e) => e.preventDefault()}>{String(c.columnDef.header)}</DropdownMenuCheckboxItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <span className="ml-auto text-[12px] text-[#73777F]">{rows.length} kartu</span>
      </div>

      {msg && <div role="status" className={"rounded-lg border px-3 py-2 text-[13px] " + (msg.bad ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>{msg.t}</div>}

      {view === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {boardColumns(rows).map((col) => (
            <section key={col.stage} aria-label={col.stage} className="flex w-[280px] shrink-0 flex-col rounded-xl border border-[#E7E9EC] bg-[#F8F9FA]"
              onDragOver={(e) => { if (canManage || code) e.preventDefault(); }} onDrop={(e) => { const id = e.dataTransfer.getData("text/fs-task"); const t = data.find((x) => x.id === id); if (t) move(t, col.stage); }}>
              <header className="flex items-center gap-2 px-3 py-2.5"><span className="size-2 rounded-full" style={{ background: STAGE_C[col.stage] }} /><b className="text-[13px] font-semibold">{col.stage}</b><span className="rounded bg-white px-1.5 text-[11px] text-[#73777F]">{col.tasks.length}</span></header>
              <div className="grid max-h-[calc(100vh-280px)] content-start gap-2 overflow-y-auto px-2 pb-2">
                {col.tasks.map((t) => (
                  <button key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/fs-task", t.id)} onClick={() => setSel(t.id)}
                    className={"grid gap-1.5 rounded-lg border bg-white p-2.5 text-left transition-colors hover:border-[#C9CDD3] " + (selId === t.id ? "border-[#2F6FEB] ring-2 ring-[#2F6FEB]/15" : "border-[#E7E9EC]")}>
                    <div className="flex items-start gap-2">
                      {t.thumb ? <img src={t.thumb} alt="" className="size-9 shrink-0 rounded-md border border-[#E7E9EC] object-cover" /> : <span className="size-9 shrink-0 rounded-md bg-[#F3F4F6]" />}
                      <div className="min-w-0"><p className="line-clamp-2 text-[13px] font-medium leading-snug">{t.title}</p><TypeDot type={t.type} types={types} /></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                      {t.deadline && <span className={"inline-flex items-center gap-1 " + (t.late ? "font-medium text-red-600" : "text-[#73777F]")}><Clock className="size-3" />{fmt(t.deadline)}</span>}
                      {t.briefOk && <span className="inline-flex items-center gap-1 text-emerald-700"><FileText className="size-3" />Brief</span>}
                      {t.review !== "none" && <span className={"inline-flex items-center gap-1 " + REVIEW[t.review]?.[1]}><ShieldCheck className="size-3" />{REVIEW[t.review]?.[0]}</span>}
                      <span className="ml-auto flex -space-x-1">{[t.producer, t.editor].filter((c, i, a) => c && a.indexOf(c) === i).map((c) => <Avatar key={c} code={c} names={names} />)}</span>
                    </div>
                  </button>
                ))}
                {!col.tasks.length && <p className="px-1 py-3 text-center text-[12px] text-[#73777F]">Kosong</p>}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E7E9EC] bg-white" tabIndex={0} onKeyDown={onTableKey} aria-label="Tabel kartu (j/k untuk pindah baris)">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead className="border-b border-[#E7E9EC] bg-[#F8F9FA]">{table.getHeaderGroups().map((hg) => <tr key={hg.id}>{hg.headers.map((h) => (
              <th key={h.id} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#73777F]">
                <button className="inline-flex items-center gap-1" onClick={h.column.getToggleSortingHandler()}>{flexRender(h.column.columnDef.header, h.getContext())}{h.column.getIsSorted() === "asc" ? <ArrowUp className="size-3" /> : h.column.getIsSorted() === "desc" ? <ArrowDown className="size-3" /> : null}</button>
              </th>))}</tr>)}</thead>
            <tbody>{tRows.map((r) => (
              <tr key={r.id} onClick={() => setSel(r.original.id)} className={"cursor-pointer border-b border-[#E7E9EC] last:border-0 " + (selId === r.original.id ? "bg-[#2F6FEB]/[0.06]" : "hover:bg-[#F8F9FA]")}>
                {r.getVisibleCells().map((c) => <td key={c.id} className="px-3 py-2 align-middle">{flexRender(c.column.columnDef.cell ?? ((x) => String(x.getValue() ?? "") || "—"), c.getContext())}</td>)}
              </tr>))}
              {!tRows.length && <tr><td colSpan={20} className="px-3 py-6 text-center text-[#73777F]">Tidak ada kartu untuk filter ini.</td></tr>}
            </tbody>
          </table>
          {table.getPageCount() > 1 && (
            <div className="flex items-center justify-end gap-2 border-t border-[#E7E9EC] px-3 py-2 text-[12px] text-[#73777F]">
              Halaman {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              <Button variant="outline" size="xs" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>‹</Button>
              <Button variant="outline" size="xs" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>›</Button>
            </div>
          )}
        </div>
      )}

      {sel && <Panel key={sel.id + ":" + sel.note} t={sel} names={names} people={people} types={types} canManage={canManage} code={code} pending={pending} onClose={() => setSel(null)} onMove={(s) => move(sel, s)} onPatch={(p, l) => patch(sel, p, l)} />}
    </div>
  );
}

function Row({ l, children }: { l: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2 py-1.5 text-[13px]"><span className="text-[#73777F]">{l}</span><div className="min-w-0">{children}</div></div>;
}
function Panel({ t, names, people, types, canManage, code, pending, onClose, onMove, onPatch }: { t: FsTask; names: Record<string, string>; people: string[]; types: Record<string, string>; canManage: boolean; code: string | null; pending: boolean; onClose: () => void; onMove: (s: string) => void; onPatch: (p: Parameters<typeof updateTask>[1], label: string) => void }) {
  const [note, setNote] = useState(t.note);
  const mine = !!code && [t.producer, t.editor, t.talent, t.script].includes(code);
  const canNote = canManage || (mine && !t.meta);
  const sel = "h-8 w-full rounded-md border border-[#E7E9EC] bg-white px-2 text-[13px] disabled:bg-[#F8F9FA]";
  return (
    <aside aria-label="Detail kartu" className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-[#E7E9EC] bg-white shadow-[-12px_0_32px_-24px_rgba(0,0,0,0.25)] sm:w-[420px]">
      <div className="flex items-start gap-3 border-b border-[#E7E9EC] p-4">
        {t.thumb ? <img src={t.thumb} alt="" className="size-14 rounded-lg border border-[#E7E9EC] object-cover" /> : <span className="size-14 rounded-lg bg-[#F3F4F6]" />}
        <div className="min-w-0 flex-1"><TypeDot type={t.type} types={types} /><h2 className="text-[16px] font-semibold leading-snug">{t.title}</h2>{t.cprId && <p className="font-mono text-[11px] text-[#73777F]">{t.cprId}</p>}</div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Tutup (Esc)"><X /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <Row l="Tahap"><select className={sel} value={t.status} disabled={pending || (!canManage && !mine)} onChange={(e) => onMove(e.target.value)}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></Row>
        <Row l="PIC Produksi"><select className={sel} value={t.producer} disabled={pending || !canManage} onChange={(e) => onPatch({ producer: e.target.value }, "PIC Produksi diperbarui.")}><option value="">—</option>{[...new Set([...people, t.producer].filter(Boolean))].map((p) => <option key={p} value={p}>{names[p] ?? p}</option>)}</select></Row>
        <Row l="PIC Editing"><select className={sel} value={t.editor} disabled={pending || !canManage} onChange={(e) => onPatch({ editor: e.target.value }, "PIC Editing diperbarui.")}><option value="">—</option>{[...new Set([...people, t.editor].filter(Boolean))].map((p) => <option key={p} value={p}>{names[p] ?? p}</option>)}</select></Row>
        <Row l="Deadline Ready"><span className={t.late ? "font-medium text-red-600" : ""}>{t.deadline ? fmt(t.deadline) + " " + t.deadline.slice(0, 4) + (t.late ? " · terlambat" : "") : "—"}</span></Row>
        <Row l="Rencana syuting">{fmt(t.shootPlan) || "—"}</Row>
        <Row l="Jadwal tayang">{t.postAt ? fmt(t.postAt) + (t.postTime ? " · " + t.postTime.replace(":", ".") : "") + (t.meta ? " · dijadwalkan di Meta" : "") : "—"}</Row>
        <Row l="Content Brief"><span className={BRIEF[t.brief][1]}>{BRIEF[t.brief][0]}</span> <a className="ml-1 text-[12px] text-[#2F6FEB] hover:underline" href={studioLink(t.id, "brief")} target="_top" onClick={(e) => openInStudio(e, t.id, "brief")}>Buka</a></Row>
        {(t.type === "vrv" || t.type === "evt") && t.cprId && <Row l="Script"><a className="text-[12px] text-[#2F6FEB] hover:underline" href={scriptLink(t.id)} target="_top" onClick={(e) => openScriptInStudio(e, t.id)}>Buka Script Konten</a></Row>}
        <Row l="Creative Review"><span className={REVIEW[t.review]?.[1]}>{REVIEW[t.review]?.[0]}</span> <a className="ml-1 text-[12px] text-[#2F6FEB] hover:underline" href={studioLink(t.id, "qa")} target="_top" onClick={(e) => openInStudio(e, t.id, "qa")}>Buka</a></Row>
        <Row l="File final">{t.driveUrl ? <a className="inline-flex items-center gap-1 text-[#2F6FEB] hover:underline" href={t.driveUrl} target="_blank" rel="noopener"><CheckCircle2 className="size-3.5" />Sudah upload</a> : <span className="text-[#73777F]">Belum upload</span>}</Row>
        <div className="mt-3 grid gap-1.5">
          <label htmlFor="fs-note" className="text-[12px] font-medium text-[#73777F]">Catatan</label>
          <textarea id="fs-note" value={note} disabled={!canNote} maxLength={1000} onChange={(e) => setNote(e.target.value)} rows={3} className="rounded-md border border-[#E7E9EC] p-2 text-[13px] disabled:bg-[#F8F9FA]" />
          {canNote && note !== t.note && <Button size="sm" className="justify-self-start" disabled={pending} onClick={() => onPatch({ note }, "Catatan disimpan.")}>Simpan catatan</Button>}
        </div>
        {t.history.length > 0 && (
          <div className="mt-4"><p className="mb-1 text-[12px] font-medium text-[#73777F]">Riwayat tahap</p>
            <ol className="grid gap-1 border-l border-[#E7E9EC] pl-3 text-[12px]">{t.history.slice().reverse().slice(0, 12).map((h, i) => <li key={i}><b className="font-medium">{h.name || "-"}</b> · {h.from || "-"} → {h.to} <span className="text-[#73777F]">{new Date(h.at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span></li>)}</ol>
          </div>
        )}
      </div>
      <div className="border-t border-[#E7E9EC] p-3"><a href={studioLink(t.id)} target="_top" onClick={(e) => openInStudio(e, t.id, "det")} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2F6FEB] hover:underline"><ExternalLink className="size-3.5" />Buka Detail lengkap di Studio</a></div>
    </aside>
  );
}
