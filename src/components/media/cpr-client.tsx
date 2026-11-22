"use client";
// CPR versi baru (beta, hanya baca): Dashboard ringkas + Content Registry (TanStack Table) + panel detail.
// Pengisian brief, Creative Review, metrik, inquiry & order tetap di Studio (aturan & izin yang sama).

import { Fragment, useMemo, useState } from "react";
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Download, ExternalLink, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CPR_CODE, cprKpi, type CprRow } from "@/lib/media/cpr-view";

const TYPE_L: Record<string, string> = { igf: "Foto Instagram", vpr: "Video produk", vrv: "Video review", evt: "Video event" };
const TYPE_C: Record<string, string> = { igf: "#E91E63", vpr: "#00ACC1", vrv: "#1F3A8A", evt: "#9E9D24" };
const STAGES = ["Terdata", "Diproduksi", "Editing", "Ready", "Tayang"];
const BRIEF: Record<string, [string, string]> = { none: ["—", "text-[#747B86]"], draft: ["Draf", "text-[#747B86]"], submitted: ["Menunggu", "text-amber-700"], approved: ["Disetujui", "text-emerald-700"], revisi: ["Revisi", "text-red-600"] };
const REVIEW: Record<string, [string, string]> = { none: ["—", "text-[#747B86]"], submitted: ["Menunggu review", "text-amber-700"], revision: ["Revision", "text-amber-700"], major: ["Major revision", "text-red-600"], blocked: ["Blocked", "text-red-600"], approved: ["Approved", "text-emerald-700"], reopened: ["Dibuka ulang", "text-amber-700"] };
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const fmt = (d: string) => (d ? Number(d.slice(8)) + " " + BULAN[Number(d.slice(5, 7)) - 1] + " " + d.slice(0, 4) : "—");
const rp = (n: number) => "Rp " + n.toLocaleString("id-ID");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) + "%" : "—");
const NA = <span className="rounded bg-[#F2F3F5] px-1.5 text-[11px] text-[#747B86]">N/A</span>;

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

function Kpi({ l, v, sub }: { l: string; v: string | number; sub: string }) {
  return (
    <div className="grid gap-1 rounded-xl border border-[#E7E9ED] bg-white p-4">
      <span className="text-[12.5px] font-medium text-[#747B86]">{l}</span>
      <b className="text-[28px] font-extrabold leading-tight text-[#202328]">{v}</b>
      <small className="text-[12px] text-[#747B86]">{sub}</small>
    </div>
  );
}

export function CprClient({ rows, names, labels, today }: { rows: CprRow[]; names: Record<string, string>; labels: Record<string, string>; today: string }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [q, setQ] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [stage, setStage] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "cprId", desc: true }]);
  const [selId, setSel] = useState<string | null>(null);
  const k = useMemo(() => cprKpi(rows, month), [rows, month]);
  const L = (id: string) => labels[id] ?? id;
  const shown = useMemo(() => {
    const w = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => r.createdDay.startsWith(month) && (!types.length || types.includes(r.type)) && (!stage || r.status === stage) &&
      (!w.length || w.every((x) => [r.cprId, r.title, names[r.producer], names[r.editor], L(r.pillar), L(r.primary)].join(" ").toLowerCase().includes(x))));
  }, [rows, month, q, types, stage, names, labels]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = rows.find((r) => r.id === selId) ?? null;

  const columns = useMemo<ColumnDef<CprRow>[]>(() => [
    { id: "cprId", header: "Content ID", accessorFn: (r) => r.cprId, cell: ({ row: { original: r } }) => <span className="font-mono text-[11px] text-[#747B86]">{r.cprId || "—"}</span> },
    { id: "title", header: "Konten", accessorFn: (r) => r.title, cell: ({ row: { original: r } }) => (
      <div className="flex min-w-[200px] items-center gap-2.5">
        {r.thumb ? <img src={r.thumb} alt="" className="size-8 shrink-0 rounded-md border border-[#E7E9ED] object-cover" /> : <span className="size-8 shrink-0 rounded-md bg-[#F2F3F5]" />}
        <div className="min-w-0"><p className="truncate font-medium text-[#202328]">{r.title}</p><span className="inline-flex items-center gap-1.5 text-[12px] text-[#747B86]"><span className="size-2 rounded-full" style={{ background: TYPE_C[r.type] }} />{CPR_CODE[r.type]} · {TYPE_L[r.type]}</span></div>
      </div>) },
    { id: "pic", header: "PIC", accessorFn: (r) => names[r.producer] ?? r.producer, cell: ({ row: { original: r } }) => <span>{names[r.producer] ?? (r.producer || "—")}{r.editor && r.editor !== r.producer ? <small className="block text-[#747B86]">Edit: {names[r.editor] ?? r.editor}</small> : null}</span> },
    { id: "status", header: "Tahap", accessorFn: (r) => STAGES.indexOf(r.status), cell: ({ row: { original: r } }) => r.status },
    { id: "okr", header: "Pillar · Primary", accessorFn: (r) => r.pillar + r.primary, cell: ({ row: { original: r } }) => r.pillar || r.primary ? <span>{r.pillar || "—"}<small className="block text-[#747B86]">{r.primary ? L(r.primary) : ""}</small></span> : <span className="text-[#747B86]">—</span> },
    { id: "brief", header: "Brief", accessorFn: (r) => r.briefSt, cell: ({ row: { original: r } }) => <span className={BRIEF[r.briefSt]?.[1]}>{BRIEF[r.briefSt]?.[0] ?? r.briefSt}</span> },
    { id: "review", header: "Creative Review", accessorFn: (r) => r.reviewScore ?? -1, cell: ({ row: { original: r } }) => <span className={REVIEW[r.reviewSt]?.[1]}>{REVIEW[r.reviewSt]?.[0] ?? r.reviewSt}{r.reviewScore != null ? " · " + r.reviewScore : ""}</span> },
    { id: "deadline", header: "Deadline Ready", accessorFn: (r) => r.deadline || "9999", cell: ({ row: { original: r } }) => <span className={r.late ? "font-medium text-red-600" : ""}>{fmt(r.deadline)}{r.late ? " · terlambat" : ""}</span> },
    { id: "inq", header: "Inq.", accessorFn: (r) => r.inquiries },
    { id: "orders", header: "Order", accessorFn: (r) => r.orders },
  ], [names, labels]); // eslint-disable-line react-hooks/exhaustive-deps
  const table = useReactTable({ data: shown, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize: 50 } } });

  const csv = () => {
    const c = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const head = ["Content ID", "Judul", "Jenis", "Tahap", "PIC produksi", "PIC editing", "Pillar", "Primary Objective", "Brief", "Creative Review", "Skor", "Deadline Ready", "Ready", "Tayang", "Inquiries", "Orders", "Revenue"];
    const body = table.getSortedRowModel().rows.map(({ original: r }) => [r.cprId, r.title, TYPE_L[r.type], r.status, names[r.producer] ?? r.producer, names[r.editor] ?? r.editor, r.pillar, L(r.primary), BRIEF[r.briefSt]?.[0], REVIEW[r.reviewSt]?.[0], r.reviewScore ?? "", r.deadline, r.readyAt, r.postAt, r.inquiries, r.orders, r.revenue]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + [head, ...body].map((x) => x.map(c).join(",")).join("\n")], { type: "text/csv" }));
    a.download = "cpr-registry-" + month + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  };

  return (
    <div className={"grid gap-4 p-4 text-[#202328] md:p-6 " + (sel ? "lg:pr-[436px]" : "")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[12px] font-medium text-[#747B86]">Media · Content Production Report</p><h1 className="text-[22px] font-bold tracking-tight">CPR <span className="align-middle text-[12px] font-medium text-[#747B86]">beta · hanya baca</span></h1></div>
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-9 rounded-lg border border-[#E7E9ED] bg-white px-2 text-[13px]" aria-label="Bulan brief" />
          <Button variant="outline" size="sm" onClick={csv}><Download />Export CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi l="Planned deliverables" v={k.planned} sub="kartu CPR bulan ini" />
        <Kpi l="Brief disetujui" v={k.briefApproved} sub={pct(k.briefApproved, k.planned) + " dari rencana"} />
        <Kpi l="Creative Review Approved" v={k.reviewApproved} sub={pct(k.reviewApproved, k.planned) + " dari rencana"} />
        <Kpi l="Tayang" v={k.published} sub="dihitung terpisah dari review" />
        <Kpi l="Ready tepat waktu" v={pct(k.onTime, k.withDeadline)} sub={k.onTime + " dari " + k.withDeadline + " ber-deadline"} />
        <Kpi l="Inquiry · Order" v={k.inquiries + " · " + k.orders} sub={k.orders ? rp(k.revenue) : "belum ada order teratribusi"} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E7E9ED] bg-white px-3 py-2">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-[#E7E9ED] px-2 focus-within:border-[#202328]">
          <Search className="size-3.5 text-[#747B86]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari Content ID, judul, PIC, pillar…" className="h-8 flex-1 bg-transparent text-[13px] outline-none" aria-label="Cari" />
        </label>
        {Object.entries(CPR_CODE).map(([t, c]) => (
          <button key={t} onClick={() => setTypes((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))} className={"rounded-md border px-2 py-1 text-[12.5px] " + (types.includes(t) ? "border-[#202328] bg-[#F2F3F5] font-semibold" : "border-[#E7E9ED] bg-white")}>{c}</button>
        ))}
        <select value={stage} onChange={(e) => setStage(e.target.value)} className="h-8 rounded-md border border-[#E7E9ED] bg-white px-2 text-[13px]" aria-label="Tahap"><option value="">Semua tahap</option>{STAGES.map((s2) => <option key={s2}>{s2}</option>)}</select>
        <span className="ml-auto text-[12px] text-[#747B86]">{shown.length} konten</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E7E9ED] bg-white">
        <table className="w-full min-w-[980px] text-[13px]">
          <thead className="border-b border-[#E7E9ED] bg-[#F7F8FA]">{table.getHeaderGroups().map((hg) => <tr key={hg.id}>{hg.headers.map((h) => (
            <th key={h.id} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#747B86]">
              <button className="inline-flex items-center gap-1" onClick={h.column.getToggleSortingHandler()}>{flexRender(h.column.columnDef.header, h.getContext())}{h.column.getIsSorted() === "asc" ? <ArrowUp className="size-3" /> : h.column.getIsSorted() === "desc" ? <ArrowDown className="size-3" /> : null}</button>
            </th>))}</tr>)}</thead>
          <tbody>{table.getRowModel().rows.map((r) => (
            <tr key={r.id} onClick={() => setSel(r.original.id)} className={"cursor-pointer border-b border-[#E7E9ED] last:border-0 " + (selId === r.original.id ? "bg-[#F2F3F5]" : "hover:bg-[#F7F8FA]")}>
              {r.getVisibleCells().map((c) => <td key={c.id} className="px-3 py-2 align-middle">{flexRender(c.column.columnDef.cell ?? ((x) => String(x.getValue() ?? "")), c.getContext())}</td>)}
            </tr>))}
            {!shown.length && <tr><td colSpan={10} className="px-3 py-6 text-center text-[#747B86]">Tidak ada konten CPR untuk bulan / filter ini.</td></tr>}
          </tbody>
        </table>
        {table.getPageCount() > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-[#E7E9ED] px-3 py-2 text-[12px] text-[#747B86]">
            Halaman {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            <Button variant="outline" size="xs" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>‹</Button>
            <Button variant="outline" size="xs" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>›</Button>
          </div>
        )}
      </div>
      <p className="text-[12px] text-[#747B86]">Bulan = bulan brief (kartu dibuat). N/A = data belum dicatat, bukan 0. Mengisi brief, review, metrik, inquiry & order tetap di Studio.</p>

      {sel && (
        <aside aria-label="Detail CPR" className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-[#E7E9ED] bg-white sm:w-[420px]">
          <div className="flex items-start gap-3 border-b border-[#E7E9ED] p-4">
            <div className="min-w-0 flex-1"><p className="font-mono text-[11px] text-[#747B86]">{sel.cprId || "Tanpa Content ID"}</p><h2 className="text-[16px] font-bold leading-snug">{sel.title}</h2><p className="text-[12px] text-[#747B86]">{TYPE_L[sel.type]} · {sel.status}</p></div>
            <Button variant="ghost" size="icon-sm" onClick={() => setSel(null)} aria-label="Tutup"><X /></Button>
          </div>
          <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4 text-[13px]">
            <section className="grid gap-1.5"><h3 className="text-[13px] font-bold">Content Brief <span className={"font-medium " + BRIEF[sel.briefSt]?.[1]}>· {BRIEF[sel.briefSt]?.[0]}{sel.briefOkV ? " v" + sel.briefOkV : ""}</span></h3>
              {sel.brief ? (
                <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-2 gap-y-1">
                  {([["Pillar", sel.brief.pillar], ["Primary", L(String(sel.brief.primary ?? ""))], ["Secondary", ((sel.brief.sec as string[]) ?? []).map(L).join(", ")], ["Target Audience", Object.values((sel.brief.aud as Record<string, string[]>) ?? {}).flat().map(L).join(", ")],
                    ["Key Message", sel.brief.km ? L(String(sel.brief.km)) : ""], ["Hook", sel.brief.hk ? L(String(sel.brief.hk)) : ""], ["CTA", sel.brief.ct ? L(String(sel.brief.ct)) : ""], ["Creative Direction", sel.brief.direction]] as [string, unknown][])
                    .filter(([, v]) => v).map(([l, v]) => <Fragment key={l}><dt className="text-[#747B86]">{l}</dt><dd className="break-words">{String(v)}</dd></Fragment>)}
                </dl>
              ) : <p className="text-[#747B86]">Belum ada brief yang disetujui.</p>}
            </section>
            <section className="grid gap-1"><h3 className="text-[13px] font-bold">Creative Review</h3>
              <p><span className={REVIEW[sel.reviewSt]?.[1]}>{REVIEW[sel.reviewSt]?.[0]}</span>{sel.reviewScore != null ? " · skor " + sel.reviewScore : ""}{sel.reviewBy ? " · " + sel.reviewBy : ""}{sel.approvedAt ? " · " + new Date(sel.approvedAt).toLocaleDateString("id-ID") : ""}</p>
            </section>
            <section className="grid gap-1"><h3 className="text-[13px] font-bold">Jadwal</h3>
              <p className="text-[#747B86]">Deadline Ready <b className={sel.late ? "text-red-600" : "text-[#202328]"}>{fmt(sel.deadline)}</b> · Ready <b className="text-[#202328]">{fmt(sel.readyAt)}</b> · Tayang <b className="text-[#202328]">{fmt(sel.postAt)}</b></p>
            </section>
            <section className="grid gap-1.5"><h3 className="text-[13px] font-bold">Metrik setelah tayang</h3>
              <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[11px] uppercase text-[#747B86]"><th>Checkpoint</th><th>Reach</th><th>Views</th><th>Saves</th><th>Shares</th></tr></thead>
                <tbody>{["D+1", "D+7", "D+30"].map((cp) => { const x = sel.snaps.find((y) => y.cp === cp); return <tr key={cp} className="border-t border-[#E7E9ED]"><td className="py-1 font-medium">{cp}</td>{(["reach", "views", "saves", "shares"] as const).map((m) => <td key={m}>{x && x[m] != null ? x[m]!.toLocaleString("id-ID") : NA}</td>)}</tr>; })}</tbody>
              </table>
            </section>
            <section className="grid gap-1"><h3 className="text-[13px] font-bold">Bisnis</h3><p>{sel.inquiries} qualified inquiry · {sel.orders} order teratribusi{sel.orders ? " · " + rp(sel.revenue) : ""}</p></section>
          </div>
          <div className="border-t border-[#E7E9ED] p-3"><a href={studioLink(sel.id)} target="_top" onClick={(e) => openInStudio(e, sel.id, "det")} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#202328] hover:underline"><ExternalLink className="size-3.5" />Buka Detail kartu di Studio</a>{(sel.type === "vrv" || sel.type === "evt") && <a href={scriptLink(sel.id)} target="_top" onClick={(e) => openScriptInStudio(e, sel.id)} className="ml-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#202328] hover:underline"><ExternalLink className="size-3.5" />Script Konten</a>}</div>
        </aside>
      )}
    </div>
  );
}
