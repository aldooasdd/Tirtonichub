"use client";
// Script Konten: daftar script (kiri) + editor dokumen (tengah) + panel Creative Review / Komentar / Riwayat / Brief (kanan).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { ArrowDownUp, ArrowUpRight, CheckCircle2, ClipboardList, FileText, History, Loader2, MessageSquare, PanelLeft, PanelRight, RotateCcw, Search, ShieldCheck, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SCRIPT_ST, type ScriptStatus } from "@/lib/media/script";
import {
  addComment, createScript, getRevision, loadScript, pollScript, restoreRevision, reviewScript, saveScript, setComment, submitScript, type ScriptPayload,
} from "@/server/actions/script";
import { DOC_CSS, ReadOnlyDoc, scriptExtensions, selectText, Toolbar } from "@/components/media/script-editor";

export type ScriptListRow = {
  taskId: string; type: string; title: string; cprId: string; stage: string; item: string; thumb: string | null; campaignId: string;
  doc: { title: string; status: string; updatedAt: number; text: string } | null;
};
type Props = { rows: ScriptListRow[]; initial: ScriptPayload | null; initialCard: string; me: string; canManage: boolean; full: boolean; people: Record<string, string> };
type Data = Extract<ScriptPayload, { doc: unknown }>;

const TYPE_L: Record<string, string> = { vrv: "Video review", evt: "Video event", idc: "Video IDCC" };
const ST_C: Record<string, string> = {
  draft: "bg-[#F2F3F5] text-[#4b505a]", review: "bg-[#E8EEFC] text-[#465EA5]", revision: "bg-[#FBEAEA] text-[#C34646]", approved: "bg-[#E5F3EA] text-[#20864E]", none: "bg-white text-[#9AA0A9] border border-dashed border-[#D9DCE1]",
};
const KIND_L: Record<string, string> = { create: "Dibuat", save: "Disimpan", submit: "Diajukan ke Creative Review Script", approve: "Disetujui", revise: "Diminta revisi", restore: "Dipulihkan" };
const when = (t: number) => new Date(t).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "baru saja" : m < 60 ? m + " mnt lalu" : m < 1440 ? Math.round(m / 60) + " jam lalu" : when(t);
};
const stChip = (s: string | null) => <span className={"inline-flex h-5 min-w-0 max-w-full items-center truncate whitespace-nowrap rounded-md px-1.5 text-[11px] font-semibold " + ST_C[s || "none"]}>{s ? SCRIPT_ST[s as ScriptStatus] || s : "Belum ada script"}</span>;
function openCardInStudio(e: React.MouseEvent, id: string) {
  if (window.parent !== window) {
    e.preventDefault();
    window.parent.postMessage({ type: "ts-open-card", id, tab: "det" }, window.location.origin);
  }
}

export function ScriptClient({ rows: rows0, initial, initialCard, me, canManage, full, people }: Props) {
  const [rows, setRows] = useState(rows0);
  const [selId, setSelId] = useState(initialCard);
  const [data, setData] = useState<ScriptPayload | null>(initial);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [fType, setFType] = useState("");
  const [fHas, setFHas] = useState("");
  const [sort, setSort] = useState<"recent" | "title" | "status">("recent");
  // null = otomatis: terbuka di layar lebar; di layar sempit tertutup bila langsung membuka script tertentu.
  const [listOpenS, setListOpen] = useState<boolean | null>(null);
  const listOpen = listOpenS ?? true;
  const [panel, setPanel] = useState<"" | "review" | "comments" | "history" | "brief">("");
  const [quote, setQuote] = useState("");


  const open = useCallback(async (taskId: string) => {
    setSelId(taskId);
    setErr("");
    setLoading(true);
    const u = new URL(window.location.href);
    u.searchParams.set("card", taskId);
    window.history.replaceState(null, "", u.toString());
    const r = await loadScript(taskId).catch(() => null);
    setLoading(false);
    if (!r || !r.ok) return setErr(r && !r.ok ? r.message : "Gagal memuat. Periksa koneksi lalu coba lagi.");
    setData(r.data);
    if (window.innerWidth < 900) setListOpen(false);
  }, []);

  const view = useMemo(() => {
    const s = q.trim().toLowerCase();
    const order = { review: 0, revision: 1, draft: 2, approved: 3 } as Record<string, number>;
    return rows
      .filter((r) => (!fType || r.type === fType) && (!fHas || (fHas === "yes" ? !!r.doc : !r.doc)))
      .filter((r) => !s || s.split(/\s+/).every((w) => [r.title, r.item, r.cprId, r.campaignId, r.doc?.title, r.doc?.text].join(" ").toLowerCase().includes(w)))
      .sort((a, b) =>
        sort === "title" ? (a.doc?.title || a.title).localeCompare(b.doc?.title || b.title)
          : sort === "status" ? (order[a.doc?.status || ""] ?? 9) - (order[b.doc?.status || ""] ?? 9)
            : (b.doc?.updatedAt ?? 0) - (a.doc?.updatedAt ?? 0));
  }, [rows, q, fType, fHas, sort]);

  const patchRow = useCallback((taskId: string, p: Partial<NonNullable<ScriptListRow["doc"]>>) => {
    setRows((rs) => rs.map((r) => (r.taskId === taskId ? { ...r, doc: { title: r.doc?.title || "", status: r.doc?.status || "draft", updatedAt: Date.now(), text: r.doc?.text || "", ...p } } : r)));
  }, []);

  const d = data && data.task && "doc" in data ? (data as Data) : null;

  return (
    <div className="flex h-dvh min-h-0 w-full overflow-hidden bg-[#F7F8FA] text-[#202328]" style={{ fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{DOC_CSS}</style>
      {/* Panel B: daftar script */}
      <aside className={(listOpenS === null && initialCard ? "hidden min-[900px]:flex" : listOpen ? "flex" : "hidden") + " absolute inset-y-0 left-0 z-30 w-[86vw] max-w-[300px] flex-col border-r border-[#E7E9ED] bg-white shadow-xl min-[900px]:static min-[900px]:z-auto min-[900px]:w-[272px] min-[900px]:shadow-none"} aria-label="Daftar script">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h1 className="text-[17px] font-bold" style={{ fontFamily: "Manrope,sans-serif" }}>Script Konten</h1>
          <button type="button" className="inline-flex size-8 items-center justify-center rounded-md hover:bg-[#F2F3F5]" title="Sembunyikan daftar" aria-label="Sembunyikan daftar" onClick={() => setListOpen(false)}><PanelLeft className="size-4" /></button>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 px-3 pb-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-[#9AA0A9]" />
            <input className="h-9 w-full rounded-lg border border-[#E7E9ED] pl-8 pr-2 text-[13px]" placeholder="Cari judul, produk, Content ID…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <Seg label="Jenis konten" value={fType} onChange={setFType} options={[["", "Semua"], ["vrv", "Review"], ["evt", "Event"], ["idc", "IDCC"]]} />
          <div className="flex min-w-0 items-center gap-1.5">
            <Seg label="Ada script" value={fHas} onChange={setFHas} options={[["", "Semua"], ["yes", "Ada"], ["no", "Belum"]]} />
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] text-[#4b505a] hover:bg-[#F2F3F5]" aria-label="Urutkan">
                <ArrowDownUp className="size-3.5" />{{ recent: "Terbaru", title: "Judul", status: "Status" }[sort]}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-36">
                <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                  <DropdownMenuRadioItem value="recent">Terbaru diubah</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="title">Judul A–Z</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="status">Status</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {(["vrv", "evt", "idc"] as const).filter((t) => !fType || fType === t).map((t) => {
            const L = view.filter((r) => r.type === t);
            return (
              <section key={t} className="mb-2">
                <h2 className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#9AA0A9]">{TYPE_L[t]} · {L.length}</h2>
                {L.length ? L.map((r) => (
                  <button key={r.taskId} type="button" onClick={() => open(r.taskId)} aria-current={selId === r.taskId ? "true" : undefined}
                    className={"flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-[#F2F3F5] " + (selId === r.taskId ? "bg-[#EEF2F8]" : "")}>
                    {r.thumb ? (<img src={r.thumb} alt="" className="mt-0.5 h-10 w-8 shrink-0 rounded object-cover" />) : <FileText className="mt-1 size-5 shrink-0 text-[#9AA0A9]" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{r.doc?.title || r.title}</span>
                      <span className="block truncate font-mono text-[10.5px] text-[#9AA0A9]">{r.cprId}</span>
                      <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">{stChip(r.doc?.status ?? null)}{r.doc && <span className="whitespace-nowrap text-[11px] text-[#9AA0A9]">{ago(r.doc.updatedAt)}</span>}</span>
                    </span>
                  </button>
                )) : <p className="px-2 py-1 text-[12px] text-[#9AA0A9]">Tidak ada.</p>}
              </section>
            );
          })}
        </div>
      </aside>
      {listOpenS === true && <button type="button" aria-label="Tutup daftar" className="absolute inset-0 z-20 bg-black/20 min-[900px]:hidden" onClick={() => setListOpen(false)} />}

      {/* Panel C: dokumen */}
      <main className="flex min-w-0 flex-1 flex-col">
        {(!listOpen || (listOpenS === null && !!initialCard)) && !d?.doc && (
          <button type="button" className={(listOpenS === null ? "min-[900px]:hidden " : "") + "absolute left-2 top-2 z-10 inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E7E9ED] bg-white px-2 text-[12px] shadow-sm"} onClick={() => setListOpen(true)}>
            <PanelLeft className="size-4" />Daftar script
          </button>
        )}
        {loading ? (
          <div className="grid flex-1 place-items-center text-[13px] text-[#747B86]"><Loader2 className="size-5 animate-spin" /></div>
        ) : err ? (
          <Empty><p className="text-[#C34646]">{err}</p></Empty>
        ) : !data ? (
          <Empty><FileText className="mx-auto mb-2 size-8 text-[#9AA0A9]" /><p className="font-semibold">Pilih script di daftar</p><p className="text-[#747B86]">Script Konten tersedia untuk Video review, Video event, dan Video IDCC yang punya Content ID.</p></Empty>
        ) : !data.task ? (
          <Empty><p>{data.why}</p></Empty>
        ) : !d?.doc ? (
          <NoDoc data={data} onCreate={async () => {
            setLoading(true);
            const r = await createScript(data.task!.id).catch(() => null);
            setLoading(false);
            if (!r || !r.ok) return setErr(r && !r.ok ? r.message : "Gagal membuat script.");
            setData(r.data);
            const dd = r.data as Data;
            if (dd.doc) patchRow(dd.task!.id, { title: dd.doc.title, status: dd.doc.status });
          }} />
        ) : (
          <DocEditor key={d.doc.id} data={d} me={me} canManage={canManage} full={full} people={people} panel={panel} setPanel={setPanel} quote={quote} setQuote={setQuote}
            onData={(nd) => { setData(nd); const x = nd as Data; if (x.doc && x.task) patchRow(x.task.id, { title: x.doc.title, status: x.doc.status }); }}
            onSaved={(p) => patchRow(d.task!.id, p)} listOpen={listOpenS === null && initialCard ? "auto" : listOpen} onOpenList={() => setListOpen(true)} />
        )}
      </main>
    </div>
  );
}

function Seg({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex min-w-0 flex-1 rounded-lg bg-[#F2F3F5] p-0.5">
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className="h-6 min-w-0 flex-1 truncate rounded-md px-1.5 text-[11.5px] text-[#747B86] hover:text-[#202328] aria-checked:bg-white aria-checked:font-semibold aria-checked:text-[#202328] aria-checked:shadow-[0_1px_2px_rgba(16,24,40,.08)] focus-visible:outline-2 focus-visible:outline-[#B5D916]">
          {l}
        </button>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid flex-1 place-items-center p-6"><div className="max-w-sm text-center text-[14px]">{children}</div></div>;
}

function NoDoc({ data, onCreate }: { data: ScriptPayload; onCreate: () => void }) {
  const t = data.task!;
  return (
    <Empty>
      <FileText className="mx-auto mb-2 size-8 text-[#9AA0A9]" />
      <p className="font-semibold">{t.title}</p>
      <p className="mb-1 font-mono text-[12px] text-[#9AA0A9]">{t.cprId}</p>
      <p className="mb-4 text-[#747B86]">Belum ada script untuk Content ID ini.</p>
      <button type="button" className="h-10 rounded-lg bg-[#222428] px-5 text-[14px] font-semibold text-white hover:bg-black" onClick={onCreate}>Buat Script</button>
      {t.gdoc && <p className="mt-4 text-[13px]"><a className="inline-flex items-center gap-1 text-[#2F6FEB] hover:underline" href={t.gdoc} target="_blank" rel="noopener noreferrer">Script lama di Google Docs <ArrowUpRight className="size-3.5" /></a></p>}
      <p className="mt-3 text-[12px] text-[#9AA0A9]">{"media" in data && data.media?.some((m) => m.ref.startsWith("item:")) ? "Foto barang akan otomatis dimasukkan di bagian atas." : "Belum ada foto yang terhubung dengan Content ID ini."}</p>
    </Empty>
  );
}

type SaveSt = "saved" | "dirty" | "saving" | "error" | "conflict";

function DocEditor({ data, me, canManage, full, people, panel, setPanel, quote, setQuote, onData, onSaved, listOpen, onOpenList }: {
  data: Data; me: string; canManage: boolean; full: boolean; people: Record<string, string>; panel: string; setPanel: (p: "" | "review" | "comments" | "history" | "brief") => void;
  quote: string; setQuote: (q: string) => void; onData: (d: ScriptPayload) => void; onSaved: (p: { title?: string; status?: string; text?: string }) => void; listOpen: boolean | "auto"; onOpenList: () => void;
}) {
  const doc = data.doc!;
  const task = data.task!;
  const [title, setTitle] = useState(doc.title);
  const [status, setStatus] = useState(doc.status);
  const [st, setSt] = useState<SaveSt>("saved");
  const [msg, setMsg] = useState("");
  const [conflict, setConflict] = useState<{ version: number; title: string; content: unknown; by: string } | null>(null);
  const [zoom, setZoom] = useState(100);
  const [remote, setRemote] = useState("");
  const ver = useRef(doc.version);
  const dirty = useRef(false);
  const saving = useRef(false);
  const titleRef = useRef(doc.title);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ext = useMemo(() => scriptExtensions(true), []);
  const markRef = useRef<() => void>(() => {});
  const saveRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const reloadRef = useRef<() => Promise<void>>(async () => {});
  const panelRef = useRef(panel);
  const ed = useEditor({
    extensions: ext, content: doc.content as object, immediatelyRender: false,
    editorProps: { attributes: { class: "sdoc", spellcheck: "true", "aria-label": "Isi script" } },
    onUpdate: () => markRef.current(),
  });

  const save = useCallback(async (force = false) => {
    if (!ed || saving.current) return;
    if (timer.current) clearTimeout(timer.current);
    saving.current = true;
    dirty.current = false;
    setSt("saving");
    const r = await saveScript(doc.id, ver.current, titleRef.current, JSON.parse(JSON.stringify(ed.getJSON())), force).catch(() => null);
    saving.current = false;
    if (!r) {
      dirty.current = true;
      setSt("error");
      setMsg("Gagal menyimpan (koneksi). Dicoba lagi otomatis…");
      timer.current = setTimeout(() => saveRef.current(), 8000);
      return;
    }
    if (!r.ok) {
      dirty.current = true;
      if ("conflict" in r) {
        setConflict(r.latest);
        setSt("conflict");
      } else {
        setSt("error");
        setMsg(r.message);
      }
      return;
    }
    ver.current = r.version;
    setStatus(r.status);
    setConflict(null);
    setMsg("");
    onSaved({ title: titleRef.current, status: r.status, text: ed.getText().slice(0, 600) });
    if (panelRef.current === "history" || panelRef.current === "review") void reloadRef.current();
    if (dirty.current) {
      setSt("dirty");
      timer.current = setTimeout(() => saveRef.current(), 1200);
    } else setSt("saved");
  }, [ed, doc.id, onSaved]);

  const mark = useCallback(() => {
    dirty.current = true;
    setSt((s) => (s === "conflict" ? s : "dirty"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveRef.current(), 1200);
  }, []);
  useEffect(() => {
    saveRef.current = save;
    markRef.current = mark;
  }, [save, mark]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current || saving.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (dirty.current && !saving.current) void saveRef.current();
  }, []);

  // Cek perubahan dari orang lain tiap 15 detik (bukan real-time; bentrok tetap dicegah saat menyimpan).
  const reload = useCallback(async () => {
    const r = await loadScript(task.id).catch(() => null);
    if (r && r.ok) {
      const nd = r.data as Data;
      if (nd.doc && !dirty.current && !saving.current && nd.doc.version !== ver.current && ed) {
        ver.current = nd.doc.version;
        ed.commands.setContent(nd.doc.content as object, { emitUpdate: false });
        setTitle(nd.doc.title);
        titleRef.current = nd.doc.title;
        setStatus(nd.doc.status);
      } else if (nd.doc && nd.doc.version !== ver.current && !dirty.current && !saving.current) ver.current = nd.doc.version;
      onData(r.data);
    }
  }, [task.id, ed, onData]);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);
  useEffect(() => {
    panelRef.current = panel;
    if (panel === "history" || panel === "review") void reload();
  }, [panel, reload]);
  useEffect(() => {
    const iv = setInterval(async () => {
      if (document.hidden) return;
      const p = await pollScript(doc.id).catch(() => null);
      if (!p || !p.ok) return;
      const cmt = data.comments.length;
      if (p.version !== ver.current || p.comments !== cmt) {
        if (p.version !== ver.current && dirty.current) setRemote(p.by);
        else {
          setRemote("");
          await reload();
        }
      }
    }, 15000);
    return () => clearInterval(iv);
  }, [doc.id, data.comments.length, reload]);

  const after = (r: { ok: true; data: ScriptPayload } | { ok: false; message: string } | null) => {
    if (!r) return setMsg("Gagal (koneksi). Coba lagi.");
    if (!r.ok) return setMsg(r.message);
    setMsg("");
    const nd = r.data as Data;
    if (nd.doc) {
      ver.current = nd.doc.version;
      setStatus(nd.doc.status);
      if (ed && JSON.stringify(ed.getJSON()) !== JSON.stringify(nd.doc.content)) ed.commands.setContent(nd.doc.content as object, { emitUpdate: false });
      setTitle(nd.doc.title);
      titleRef.current = nd.doc.title;
    }
    onData(r.data);
  };

  const n = (id: string | null | undefined) => (id ? data.names[id] || "Anggota" : "");
  const saveLabel = st === "saving" ? "Menyimpan…" : st === "dirty" ? "Belum tersimpan" : st === "error" ? "Gagal menyimpan" : st === "conflict" ? "Bentrok" : "Tersimpan";
  const openComments = data.comments.filter((c) => !c.resolvedAt).length;

  if (!ed) return <div className="grid flex-1 place-items-center"><Loader2 className="size-5 animate-spin text-[#747B86]" /></div>;
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#E7E9ED] bg-white px-3 pb-2 pt-3 min-[900px]:px-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {listOpen !== true && (
              <button type="button" className={(listOpen === "auto" ? "min-[900px]:hidden " : "") + "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-[#E7E9ED]"} title="Daftar script" aria-label="Daftar script" onClick={onOpenList}>
                <PanelLeft className="size-4" />
              </button>
            )}
            <input className="min-w-[180px] flex-1 rounded-md border border-transparent px-1 py-0.5 text-[19px] font-bold hover:border-[#E7E9ED] focus:border-[#B5D916] focus:outline-none" style={{ fontFamily: "Manrope,sans-serif" }}
              value={title} aria-label="Judul dokumen" maxLength={160} onChange={(e) => { setTitle(e.target.value); titleRef.current = e.target.value; mark(); }} />
            <span className={"text-[12px] " + (st === "error" || st === "conflict" ? "text-[#C34646]" : "text-[#747B86]")} aria-live="polite">{saveLabel}</span>
            {st === "error" && <button type="button" className="h-7 rounded-md border border-[#E7E9ED] px-2 text-[12px]" onClick={() => save()}>Coba lagi</button>}
            <div className="flex items-center gap-1">
              {([["review", ShieldCheck, "Creative Review Script"], ["comments", MessageSquare, "Komentar" + (openComments ? " (" + openComments + ")" : "")], ["history", History, "Riwayat versi"], ["brief", ClipboardList, "Brief & info"]] as const).map(([k, I, l]) => (
                <button key={k} type="button" title={l} aria-label={l} aria-pressed={panel === k} onClick={() => setPanel(panel === k ? "" : k)}
                  className="relative inline-flex size-8 items-center justify-center rounded-md text-[#3c4049] hover:bg-[#F2F3F5] aria-pressed:bg-[#E9F2C4]">
                  <I className="size-4" />{k === "comments" && openComments > 0 && <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-[#B5D916] text-[9px] font-bold text-[#1c2700]">{openComments}</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[12px] text-[#747B86]">
            {stChip(status)}
            <span className="font-mono">{task.cprId}</span><span>·</span><span>{TYPE_L[task.type]}</span>{task.item && <><span>·</span><span>{task.item}</span></>}<span>·</span><span>Tahap {task.status}</span>
            <a className="inline-flex items-center gap-0.5 text-[#2F6FEB] hover:underline" href={"/studio/?p=pipeline&card=" + encodeURIComponent(task.id) + "&tab=det"} target="_top" onClick={(e) => openCardInStudio(e, task.id)}>Buka kartu<ArrowUpRight className="size-3" /></a>
            {task.gdoc && <a className="inline-flex items-center gap-0.5 text-[#2F6FEB] hover:underline" href={task.gdoc} target="_blank" rel="noopener noreferrer">Google Docs lama<ArrowUpRight className="size-3" /></a>}
          </div>
        </header>
        <Toolbar ed={ed} zoom={zoom} setZoom={setZoom} media={data.media} onComment={(qt) => { setQuote(qt); setPanel("comments"); }} />
        {(conflict || remote || status === "review" || msg) && (
          <div className="border-b border-[#E7E9ED] bg-[#FFFBEB] px-4 py-2 text-[13px]">
            {conflict ? (
              <span className="flex flex-wrap items-center gap-2">
                <b>{conflict.by || "Orang lain"} menyimpan script ini lebih dulu.</b> Perubahan Anda belum disimpan.
                <button type="button" className="h-7 rounded-md border border-[#E7E9ED] bg-white px-2" onClick={() => { ed.commands.setContent(conflict.content as object, { emitUpdate: false }); ver.current = conflict.version; setTitle(conflict.title); titleRef.current = conflict.title; dirty.current = false; setConflict(null); setSt("saved"); }}>Muat versi terbaru (buang perubahan saya)</button>
                <button type="button" className="h-7 rounded-md bg-[#222428] px-2 text-white" onClick={() => { setConflict(null); void save(true); }}>Tetap simpan versi saya</button>
              </span>
            ) : remote ? <span>{remote} baru saja mengubah script ini. Perubahan Anda akan dicek saat disimpan.</span>
              : msg ? <span className="text-[#C34646]">{msg}</span>
                : <span>Script sedang di Creative Review Script. Mengubah isi akan membatalkan pengajuan (versi yang diajukan tetap tersimpan di Riwayat).</span>}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto px-3 py-6 min-[900px]:px-8">
          <div className="sprint mx-auto w-full max-w-[816px] rounded-sm border border-[#E7E9ED] bg-white px-5 py-8 shadow-[0_1px_3px_rgba(16,24,40,.06)] min-[700px]:px-[72px] min-[700px]:py-[64px]"
            style={{ zoom: zoom / 100 }} onClick={(e) => { if (e.target === e.currentTarget) ed.commands.focus("end"); }}>
            <EditorContent editor={ed} />
          </div>
        </div>
      </div>
      {panel && (
        <aside className="absolute inset-y-0 right-0 z-30 flex w-[92vw] max-w-[340px] flex-col border-l border-[#E7E9ED] bg-white shadow-xl min-[1200px]:static min-[1200px]:w-[320px] min-[1200px]:shadow-none" aria-label="Panel samping">
          <div className="flex items-center justify-between border-b border-[#E7E9ED] px-4 py-3">
            <b className="text-[14px]">{{ review: "Creative Review Script", comments: "Komentar", history: "Riwayat versi", brief: "Brief & info konten" }[panel]}</b>
            <button type="button" className="inline-flex size-8 items-center justify-center rounded-md hover:bg-[#F2F3F5]" aria-label="Tutup panel" onClick={() => setPanel("")}><PanelRight className="size-4" /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 text-[13px]">
            {panel === "review" && <ReviewPanel data={data} status={status} me={me} canManage={canManage} full={full} busy={st !== "saved"} n={n}
              onSubmit={async () => after(await submitScript(doc.id, ver.current).catch(() => null))}
              onReview={async (dec, note, exc) => after(await reviewScript(doc.id, dec, note, exc).catch(() => null))} />}
            {panel === "comments" && <CommentPanel data={data} me={me} canManage={canManage} quote={quote} setQuote={setQuote} n={n} onFind={(t) => selectText(ed, t)}
              onAdd={async (body) => { const r = await addComment(doc.id, body, quote).catch(() => null); if (!r || !r.ok) return setMsg(r && !r.ok ? r.message : "Gagal mengirim komentar."); setQuote(""); await reload(); }}
              onSet={async (id, act) => { const r = await setComment(id, act).catch(() => null); if (!r || !r.ok) return setMsg(r && !r.ok ? r.message : "Gagal."); await reload(); }} />}
            {panel === "history" && <HistoryPanel data={data} n={n} busy={st !== "saved"}
              onRestore={async (rev) => after(await restoreRevision(doc.id, rev, ver.current).catch(() => null))} />}
            {panel === "brief" && <BriefPanel data={data} people={people} />}
          </div>
        </aside>
      )}
    </div>
  );
}

function ReviewPanel({ data, status, me, canManage, full, busy, n, onSubmit, onReview }: {
  data: Data; status: string; me: string; canManage: boolean; full: boolean; busy: boolean; n: (id: string) => string;
  onSubmit: () => Promise<void>; onReview: (d: "approve" | "revise", note: string, exc: string) => Promise<void>;
}) {
  const doc = data.doc!;
  const [note, setNote] = useState("");
  const [exc, setExc] = useState("");
  const [wait, setWait] = useState(false);
  const isWriter = doc.writers.includes(me);
  const run = async (f: () => Promise<void>) => { setWait(true); await f(); setWait(false); };
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">{stChip(status)}{doc.submittedRev && status === "review" && <span className="text-[#747B86]">versi r{doc.submittedRev}</span>}</div>
        {doc.approvedRev && <p className="text-[#20864E]"><CheckCircle2 className="mr-1 inline size-3.5" />Versi disetujui terakhir: r{doc.approvedRev}{status !== "approved" ? " (isi sudah diubah setelahnya)" : ""}</p>}
        <p className="text-[12px] text-[#747B86]">Penulis: {doc.writers.map(n).join(", ") || "—"}</p>
        <p className="text-[12px] text-[#9AA0A9]">Terpisah dari Creative Review konten (file final) di Detail kartu. Persetujuan script tidak mengubah tahap kartu di FlowSpace.</p>
      </div>
      {(status === "draft" || status === "revision") && (
        <button type="button" disabled={busy || wait} className="h-9 rounded-lg bg-[#222428] font-semibold text-white disabled:opacity-40" onClick={() => run(onSubmit)}>
          {busy ? "Tunggu tersimpan…" : "Ajukan Creative Review Script"}
        </button>
      )}
      {status === "review" && canManage && (
        <div className="grid gap-2 rounded-lg border border-[#E7E9ED] p-3">
          <b>Keputusan Creative Review Script</b>
          <textarea className="min-h-20 rounded-md border border-[#E7E9ED] p-2" placeholder="Catatan (wajib bila minta revisi)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
          {isWriter && full && <input className="h-9 rounded-md border border-[#E7E9ED] px-2" placeholder="Alasan menyetujui script yang Anda tulis" value={exc} onChange={(e) => setExc(e.target.value)} maxLength={500} />}
          {isWriter && !full && <p className="text-[12px] text-[#C34646]">Anda ikut menulis script ini, jadi tidak bisa menyetujuinya.</p>}
          <div className="flex gap-2">
            <button type="button" disabled={wait || (isWriter && !full)} className="h-9 flex-1 rounded-lg bg-[#20864E] font-semibold text-white disabled:opacity-40" onClick={() => run(() => onReview("approve", note, exc))}>Setujui</button>
            <button type="button" disabled={wait || !note.trim()} className="h-9 flex-1 rounded-lg border border-[#C34646] font-semibold text-[#C34646] disabled:opacity-40" onClick={() => run(() => onReview("revise", note, exc))}>Minta revisi</button>
          </div>
        </div>
      )}
      {status === "review" && !canManage && <p className="text-[#747B86]">Menunggu keputusan admin / Admin 2.</p>}
      <div>
        <b className="mb-1 block">Riwayat keputusan</b>
        {data.reviews.length ? data.reviews.map((r) => (
          <div key={r.id} className="border-b border-[#F2F3F5] py-2">
            <span className={r.decision === "approve" ? "font-semibold text-[#20864E]" : "font-semibold text-[#C34646]"}>{r.decision === "approve" ? "Disetujui" : "Minta revisi"}</span> · r{r.rev} · {n(r.byId)} · {when(r.createdAt)}
            {r.note && <p className="mt-0.5 whitespace-pre-wrap text-[#4b505a]">{r.note}</p>}
            {r.exc && <p className="mt-0.5 text-[12px] text-[#747B86]">Alasan: {r.exc}</p>}
          </div>
        )) : <p className="text-[#9AA0A9]">Belum ada.</p>}
      </div>
    </div>
  );
}

function CommentPanel({ data, me, canManage, quote, setQuote, n, onFind, onAdd, onSet }: {
  data: Data; me: string; canManage: boolean; quote: string; setQuote: (q: string) => void; n: (id: string) => string; onFind: (t: string) => boolean;
  onAdd: (body: string) => Promise<void>; onSet: (id: string, act: "resolve" | "reopen") => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [showDone, setShowDone] = useState(false);
  const list = data.comments.filter((c) => showDone || !c.resolvedAt).slice().reverse();
  return (
    <div className="grid gap-3">
      <form className="grid gap-2" onSubmit={async (e) => { e.preventDefault(); if (!body.trim()) return; await onAdd(body); setBody(""); }}>
        {quote ? (
          <div className="flex items-start gap-1 rounded-md bg-[#FFF8D6] px-2 py-1 text-[12px]"><span className="flex-1">“{quote}”</span><button type="button" aria-label="Hapus kutipan" onClick={() => setQuote("")}><X className="size-3.5" /></button></div>
        ) : <p className="text-[12px] text-[#9AA0A9]">Pilih teks di dokumen lalu klik ikon komentar untuk mengomentari bagian tertentu.</p>}
        <textarea className="min-h-20 rounded-md border border-[#E7E9ED] p-2" placeholder="Tulis komentar…" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
        <button className="h-9 rounded-lg bg-[#222428] font-semibold text-white disabled:opacity-40" disabled={!body.trim()}>Kirim komentar</button>
      </form>
      <label className="flex items-center gap-2 text-[12px] text-[#747B86]"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />Tampilkan yang sudah selesai</label>
      {list.length ? list.map((c) => (
        <div key={c.id} className={"rounded-lg border border-[#E7E9ED] p-2.5 " + (c.resolvedAt ? "opacity-60" : "")}>
          <div className="text-[12px] text-[#747B86]"><b className="text-[#202328]">{n(c.byId)}</b> · {when(c.createdAt)}</div>
          {c.quote && <button type="button" className="my-1 block w-full truncate rounded bg-[#FFF8D6] px-1.5 py-0.5 text-left text-[12px]" title="Tampilkan di dokumen" onClick={() => onFind(c.quote!)}>“{c.quote}”</button>}
          <p className="whitespace-pre-wrap">{c.body}</p>
          <div className="mt-1.5 flex items-center justify-between text-[12px]">
            {c.resolvedAt ? <span className="text-[#20864E]">Selesai · {n(c.resolvedById || "")}</span> : <span />}
            {!c.resolvedAt && (c.byId === me || canManage) && <button type="button" className="text-[#2F6FEB] hover:underline" onClick={() => onSet(c.id, "resolve")}>Selesaikan</button>}
            {c.resolvedAt && canManage && <button type="button" className="text-[#2F6FEB] hover:underline" onClick={() => onSet(c.id, "reopen")}>Buka lagi</button>}
          </div>
        </div>
      )) : <p className="text-[#9AA0A9]">Belum ada komentar.</p>}
    </div>
  );
}

function HistoryPanel({ data, n, busy, onRestore }: { data: Data; n: (id: string) => string; busy: boolean; onRestore: (rev: number) => Promise<void> }) {
  const doc = data.doc!;
  const [view, setView] = useState<{ rev: number; title: string; content: unknown } | null>(null);
  return (
    <div className="grid gap-1">
      <p className="mb-2 text-[12px] text-[#9AA0A9]">Versi disimpan saat dibuat, diajukan, disetujui, dipulihkan, dan saat simpan otomatis (paling sering 15 menit sekali per orang).</p>
      {data.revisions.map((r) => (
        <div key={r.rev} className="flex items-start gap-2 border-b border-[#F2F3F5] py-2">
          <span className="w-9 shrink-0 font-mono text-[12px] text-[#747B86]">r{r.rev}</span>
          <span className="min-w-0 flex-1">
            <span className="block">{KIND_L[r.kind] || r.kind}{r.rev === doc.approvedRev && <span className="ml-1 rounded bg-[#E5F3EA] px-1 text-[11px] font-semibold text-[#20864E]">disetujui</span>}{r.rev === doc.submittedRev && <span className="ml-1 rounded bg-[#E8EEFC] px-1 text-[11px] font-semibold text-[#465EA5]">diajukan</span>}</span>
            <span className="block text-[12px] text-[#747B86]">{n(r.byId)} · {when(r.createdAt)}</span>
          </span>
          <button type="button" className="text-[12px] text-[#2F6FEB] hover:underline" onClick={async () => { const x = await getRevision(doc.id, r.rev).catch(() => null); if (x && x.ok) setView({ rev: r.rev, title: x.title, content: x.content }); }}>Lihat</button>
        </div>
      ))}
      {view && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-3" role="dialog" aria-modal="true" aria-label={"Versi r" + view.rev}>
          <div className="flex max-h-[92dvh] w-full max-w-[860px] flex-col rounded-xl bg-white shadow-2xl">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#E7E9ED] px-4 py-3">
              <b className="flex-1">r{view.rev} · {view.title}</b>
              <button type="button" disabled={busy} className="inline-flex h-8 items-center gap-1 rounded-md border border-[#E7E9ED] px-2.5 text-[13px] disabled:opacity-40" title={busy ? "Tunggu perubahan tersimpan" : ""}
                onClick={async () => { if (!window.confirm("Pulihkan versi r" + view.rev + "? Isi sekarang tetap tersimpan di riwayat.")) return; await onRestore(view.rev); setView(null); }}>
                <RotateCcw className="size-3.5" />Pulihkan versi ini
              </button>
              <button type="button" className="inline-flex size-8 items-center justify-center rounded-md hover:bg-[#F2F3F5]" aria-label="Tutup" onClick={() => setView(null)}><X className="size-4" /></button>
            </div>
            <div className="min-h-0 overflow-y-auto px-5 py-6 min-[700px]:px-12"><ReadOnlyDoc content={view.content} /></div>
          </div>
        </div>
      )}
    </div>
  );
}

function BriefPanel({ data, people }: { data: Data; people: Record<string, string> }) {
  const t = data.task!;
  const row = (l: string, v: React.ReactNode) => (v ? <div className="grid grid-cols-[110px_1fr] gap-2 border-b border-[#F2F3F5] py-1.5"><span className="text-[#747B86]">{l}</span><span className="min-w-0 break-words">{v}</span></div> : null);
  const p = (c: string) => (c ? people[c] || c : "");
  const b = t.brief?.data ?? {};
  const txt = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : "");
  const list = (k: string) => (Array.isArray(b[k]) ? (b[k] as unknown[]).map(String).join(", ") : "");
  return (
    <div>
      <p className="mb-2 text-[12px] text-[#9AA0A9]">Data dari kartu & CPR (hanya dibaca). Mengubah judul script tidak mengubah nama barang atau kartu.</p>
      {row("Content ID", <span className="font-mono">{t.cprId}</span>)}
      {row("Jenis", TYPE_L[t.type])}
      {row("Barang", t.item)}
      {row("Campaign", t.campaignId)}
      {row("Tahap", t.status)}
      {row("Produksi", t.shootPlan)}
      {row("Deadline Ready", t.deadline)}
      {row("PIC", [t.producer && "Produksi: " + p(t.producer), t.editor && "Edit: " + p(t.editor), t.talent && "Talent: " + p(t.talent), t.script && "Script: " + p(t.script)].filter(Boolean).join(" · "))}
      {row("Google Docs", t.gdoc && <a className="text-[#2F6FEB] hover:underline" href={t.gdoc} target="_blank" rel="noopener noreferrer">Buka</a>)}
      <b className="mb-1 mt-4 block">Content Brief disetujui{t.brief ? " · v" + t.brief.v : ""}</b>
      {t.brief ? (
        <>
          {row("Pillar", txt("pillar"))}
          {row("Primary", txt("primary"))}
          {row("Pesan", txt("message"))}
          {row("Hook", txt("hook"))}
          {row("CTA", txt("cta"))}
          {row("Direction", txt("direction"))}
          {row("Referensi", txt("refs"))}
          {row("Key message", list("km"))}
          {row("Audiens", txt("audience"))}
        </>
      ) : <p className="text-[#9AA0A9]">Belum ada brief yang disetujui.</p>}
    </div>
  );
}
