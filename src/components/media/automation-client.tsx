"use client";
// Halaman Otomasi (Workflow Automation) gaya Attio: daftar workflow, Builder React Flow, Runs, Approval Inbox, Audit, Konfigurasi.
// Semua aksi lewat server action (izin dicek di server). Uji coba (Test Run) tidak mengubah data.

import "@xyflow/react/dist/style.css";
import { Fragment, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  addEdge, Background, BackgroundVariant, Controls, Handle, MiniMap, Position, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState,
  type Connection, type Edge, type Node, type NodeProps,
} from "@xyflow/react";
import {
  AlertTriangle, Bell, CheckCircle2, CircleDot, Clock, Flag, GitBranch, Inbox, ListChecks, Megaphone, Play, Redo2, Save, ShieldCheck, Undo2, UserPlus, Zap, BarChart3, Settings2, History, Workflow as WfIcon,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  disableWorkflow, loadApprovals, loadAudit, loadAutomation, loadRuns, publishWorkflow, saveDraft, savePolicy, setWorker, testCards, testWorkflow, type Perms,
} from "@/server/actions/automation";
import { COND_FIELDS, COND_OPS, EVENT_TYPES, HANDLES, NODE_TYPES, RECIPIENTS, TEMPLATES, type GNode, type Graph, type NodeType } from "@/server/automation/types";
import { POLICIES, type Policy, type PolicyKey } from "@/server/automation/policies";
import { validateGraph, type Issue } from "@/server/automation/validate";
import { stableJson } from "@/lib/stable-json";

type Init = Extract<Awaited<ReturnType<typeof loadAutomation>>, { ok: true }>["data"];
type Wf = Init["workflows"][number];
type ND = { type: NodeType; cfg: Record<string, unknown>; issue?: string };

const IC: Record<NodeType, { I: typeof Zap; c: string }> = {
  trigger: { I: Zap, c: "#2F6FEB" }, condition: { I: GitBranch, c: "#8E24AA" }, assign_owner: { I: UserPlus, c: "#16834A" }, attach_campaign: { I: Megaphone, c: "#C0CA33" },
  request_qa: { I: ListChecks, c: "#00838F" }, human_approval: { I: ShieldCheck, c: "#E65100" }, notify: { I: Bell, c: "#E91E63" }, wait: { I: Clock, c: "#795548" },
  performance_eval: { I: BarChart3, c: "#3F51B5" }, end: { I: Flag, c: "#546E7A" },
};
const ST: Record<string, [string, string]> = {
  draft: ["Draft", "bg-zinc-100 text-zinc-700"], published: ["Published", "bg-emerald-50 text-emerald-700"], disabled: ["Disabled", "bg-zinc-200 text-zinc-600"],
  running: ["Running", "bg-blue-50 text-blue-700"], waiting_for_human: ["Waiting for approval", "bg-amber-50 text-amber-700"], completed: ["Completed", "bg-emerald-50 text-emerald-700"],
  failed: ["Failed", "bg-red-50 text-red-700"], needs_configuration: ["Needs configuration", "bg-orange-50 text-orange-700"], skipped: ["Skipped", "bg-zinc-100 text-zinc-600"],
  active: ["Active", "bg-emerald-50 text-emerald-700"], waiting: ["Waiting", "bg-amber-50 text-amber-700"],
};
const Tag = ({ s }: { s: string }) => <span className={"inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium " + (ST[s]?.[1] ?? "bg-zinc-100 text-zinc-700")}>{ST[s]?.[0] ?? s}</span>;

function summary(t: NodeType, c: Record<string, unknown>): string {
  switch (t) {
    case "trigger": return EVENT_TYPES[c.event as keyof typeof EVENT_TYPES] ?? "Pilih event";
    case "condition": { const f = COND_FIELDS[String(c.field)]; return f ? f.l + " " + (COND_OPS[c.op as keyof typeof COND_OPS] ?? "") + " " + [c.value].flat().join(", ") : "Pilih kondisi"; }
    case "assign_owner": return c.role === "editor" ? "Isi PIC Editing bila kosong (jobdesk)" : "Isi PIC Produksi bila kosong (jobdesk)";
    case "notify": return (RECIPIENTS[c.to as keyof typeof RECIPIENTS] ?? "Penerima?") + " · " + (TEMPLATES[c.template as keyof typeof TEMPLATES] ?? "pesan?");
    case "human_approval": return "Tunggu keputusan Creative Review (orang)";
    case "request_qa": return "Muat checklist Creative Review sesuai jenis konten";
    case "wait": return "Jadwalkan pengingat dari aturan";
    case "performance_eval": return "Pengingat catat metrik D+n dari aturan";
    case "attach_campaign": return "Butuh campaign master";
    case "end": return "Selesai";
  }
}

function AutoNode({ data, selected }: NodeProps<Node<ND>>) {
  const { I, c } = IC[data.type];
  const hs = HANDLES[data.type];
  return (
    <div className={"w-[230px] rounded-xl border bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] " + (selected ? "border-[#2F6FEB] ring-2 ring-[#2F6FEB]/15" : data.issue ? "border-red-300" : "border-[#E7E9EC]")}>
      {data.type !== "trigger" && <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-[#2F6FEB] !bg-white" />}
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-md" style={{ background: c + "1a", color: c }}><I className="size-3.5" /></span>
        <span className="text-[13px] font-semibold text-[#202124]">{NODE_TYPES[data.type]}</span>
      </div>
      <p className="mt-1 text-[12px] leading-snug text-[#73777F]">{summary(data.type, data.cfg)}</p>
      {data.issue && <p className="mt-1 flex items-center gap-1 text-[11px] text-red-600"><AlertTriangle className="size-3" />{data.issue}</p>}
      {data.type !== "end" && !hs && <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-[#2F6FEB] !bg-white" />}
      {hs?.map((h, i) => (
        <Handle key={h} id={h} type="source" position={Position.Bottom} style={{ left: `${(i + 1) * (100 / (hs.length + 1))}%` }} className="!h-2 !w-2 !border-[#2F6FEB] !bg-white">
          <span className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-[10px] text-[#73777F]">{h}</span>
        </Handle>
      ))}
    </div>
  );
}
const nodeTypes = { auto: AutoNode };
const EDGE = { type: "smoothstep", style: { stroke: "#2F6FEB", strokeWidth: 1.4 } };

const toFlow = (g: Graph, issues: Issue[]) => ({
  nodes: g.nodes.map((n): Node<ND> => ({ id: n.id, type: "auto", position: n.position ?? { x: 0, y: 0 }, data: { type: n.type, cfg: n.data ?? {}, issue: issues.find((i) => i.nodeId === n.id)?.msg } })),
  edges: g.edges.map((e): Edge => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null, label: e.sourceHandle ?? undefined, ...EDGE })),
});
const fromFlow = (ns: Node<ND>[], es: Edge[]): Graph => ({
  nodes: ns.map((n): GNode => ({ id: n.id, type: n.data.type, data: n.data.cfg, position: { x: Math.round(n.position.x), y: Math.round(n.position.y) } })),
  edges: es.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null })),
});

function F({ l, children }: { l: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-[12px] font-medium text-[#73777F]">{l}{children}</label>;
}
const sel = "h-8 w-full rounded-md border border-[#E7E9EC] bg-white px-2 text-[13px] text-[#202124] focus:border-[#2F6FEB] focus:outline-none";

function Inspector({ node, edit, onChange, onDelete }: { node: Node<ND> | null; edit: boolean; onChange: (cfg: Record<string, unknown>) => void; onDelete: () => void }) {
  if (!node) return <p className="text-[13px] text-[#73777F]">Pilih node di kanvas untuk mengatur isinya.</p>;
  const { type, cfg } = node.data;
  const set = (k: string, v: unknown) => onChange({ ...cfg, [k]: v });
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold"><span style={{ color: IC[type].c }}>●</span>{NODE_TYPES[type]}</div>
      {type === "trigger" && <F l="Event pemicu"><select disabled={!edit} className={sel} value={String(cfg.event ?? "")} onChange={(e) => set("event", e.target.value)}><option value="">Pilih…</option>{Object.entries(EVENT_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></F>}
      {type === "condition" && (
        <>
          <F l="Field"><select disabled={!edit} className={sel} value={String(cfg.field ?? "")} onChange={(e) => onChange({ field: e.target.value, op: "eq", value: COND_FIELDS[e.target.value]?.values[0] ?? "" })}><option value="">Pilih…</option>{Object.entries(COND_FIELDS).map(([k, f]) => <option key={k} value={k}>{f.l}</option>)}</select></F>
          <F l="Operator"><select disabled={!edit} className={sel} value={String(cfg.op ?? "eq")} onChange={(e) => set("op", e.target.value)}>{Object.entries(COND_OPS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></F>
          {COND_FIELDS[String(cfg.field)] && (
            <F l="Nilai (dari daftar resmi)">
              {cfg.op === "in" ? (
                <div className="flex flex-wrap gap-1.5">{COND_FIELDS[String(cfg.field)].values.map((v) => { const on = [cfg.value].flat().includes(v); return <button key={v} type="button" disabled={!edit} onClick={() => set("value", on ? [cfg.value].flat().filter((x) => x !== v) : [...[cfg.value].flat().filter(Boolean), v])} className={"rounded-md border px-2 py-0.5 text-[12px] " + (on ? "border-[#2F6FEB] bg-[#2F6FEB]/10 text-[#2F6FEB]" : "border-[#E7E9EC]")}>{v}</button>; })}</div>
              ) : (
                <select disabled={!edit} className={sel} value={String([cfg.value].flat()[0] ?? "")} onChange={(e) => set("value", e.target.value)}>{COND_FIELDS[String(cfg.field)].values.map((v) => <option key={v}>{v}</option>)}</select>
              )}
            </F>
          )}
        </>
      )}
      {type === "assign_owner" && <F l="PIC yang diisi (hanya bila kosong)"><select disabled={!edit} className={sel} value={String(cfg.role ?? "producer")} onChange={(e) => set("role", e.target.value)}><option value="producer">PIC Produksi</option><option value="editor">PIC Editing</option></select></F>}
      {type === "notify" && (
        <>
          <F l="Penerima"><select disabled={!edit} className={sel} value={String(cfg.to ?? "")} onChange={(e) => set("to", e.target.value)}><option value="">Pilih…</option>{Object.entries(RECIPIENTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></F>
          <F l="Template pesan"><select disabled={!edit} className={sel} value={String(cfg.template ?? "")} onChange={(e) => set("template", e.target.value)}><option value="">Pilih…</option>{Object.entries(TEMPLATES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></F>
        </>
      )}
      {type === "human_approval" && <p className="text-[12px] text-[#73777F]">Menunggu keputusan Creative Review oleh admin / Admin 2 di Detail kartu. Lolos Creative Review tidak pernah berarti otomatis disetujui. Cabang: approved / revision.</p>}
      {["wait", "performance_eval", "request_qa", "attach_campaign", "end"].includes(type) && <p className="text-[12px] text-[#73777F]">Node ini tidak punya isian. Nilai bisnisnya diambil dari tab Konfigurasi.</p>}
      {node.data.issue && <p className="flex items-center gap-1 text-[12px] text-red-600"><AlertTriangle className="size-3.5" />{node.data.issue}</p>}
      {edit && type !== "trigger" && <Button variant="outline" size="sm" onClick={onDelete}>Hapus node</Button>}
    </div>
  );
}

function Builder({ wf, perms, policies, onSaved }: { wf: Wf; perms: Perms; policies: Policy[]; onSaved: () => void }) {
  const init = useMemo(() => toFlow(wf.draft, wf.issues), [wf]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ND>>(init.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(init.edges);
  const [selId, setSel] = useState<string | null>(null);
  const [rev, setRev] = useState(wf.draftRev);
  const [hist, setHist] = useState<{ past: Graph[]; future: Graph[] }>({ past: [], future: [] });
  const [msg, setMsg] = useState<string>("");
  const [cards, setCards] = useState<{ id: string; title: string; type: string; status: string }[]>([]);
  const [card, setCard] = useState("");
  const [test, setTest] = useState<{ status: string; steps: { nodeId: string; status: string; handle: string | null; result: Record<string, unknown> }[] } | null>(null);
  const [pending, start] = useTransition();
  const edit = perms.edit;
  const graph = fromFlow(nodes, edges);
  const issues = validateGraph(graph);
  // Dibandingkan dengan urutan kunci tetap: draf dari database (JSONB) menyusun ulang kunci, dulu membuat draf selalu
  // "belum disimpan" sehingga Test Run & Publish tidak pernah aktif. base = draf terakhir yang tersimpan.
  const [base, setBase] = useState(() => stableJson(wf.draft));
  const [savedG, setSavedG] = useState<Graph>(() => wf.draft);
  const dirty = stableJson(graph) !== base;
  const testWhy = !perms.test ? "Anda tidak punya izin Test Run." : pending ? "Sedang memproses…" : dirty ? "Simpan draf dulu (Save draft): Test Run memakai draf yang tersimpan." : issues.length ? "Perbaiki dulu: " + issues[0].msg : !cards.length ? "Belum ada kartu Foto IG / Video produk / Video review / Video event untuk diuji." : !card ? "Pilih kartu untuk Test Run." : "";
  const needs = wf.needs.filter((n) => !policies.find((p) => p.key === n.key && p.status === "active"));

  useEffect(() => { setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, issue: issues.find((i) => i.nodeId === n.id)?.msg } }))); }, [JSON.stringify(issues)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (perms.test) void testCards().then((r) => r.ok && setCards(r.data)); }, [perms.test]);

  const snapshot = () => setHist((h) => ({ past: [...h.past.slice(-29), fromFlow(nodes, edges)], future: [] }));
  const restore = (g: Graph) => { const f = toFlow(g, validateGraph(g)); setNodes(f.nodes); setEdges(f.edges); };
  const undo = () => setHist((h) => { const p = h.past.at(-1); if (!p) return h; const cur = fromFlow(nodes, edges); restore(p); return { past: h.past.slice(0, -1), future: [cur, ...h.future] }; });
  const redo = () => setHist((h) => { const f = h.future[0]; if (!f) return h; const cur = fromFlow(nodes, edges); restore(f); return { past: [...h.past, cur], future: h.future.slice(1) }; });
  const onConnect = useCallback((c: Connection) => { if (!edit) return; snapshot(); setEdges((es) => addEdge({ ...c, id: c.source + "-" + c.target + (c.sourceHandle ? "-" + c.sourceHandle : ""), label: c.sourceHandle ?? undefined, ...EDGE }, es.filter((e) => !(e.source === c.source && (e.sourceHandle ?? null) === (c.sourceHandle ?? null))))); }, [edit, nodes, edges]); // eslint-disable-line react-hooks/exhaustive-deps
  const addNode = (t: NodeType, pos?: { x: number; y: number }) => {
    if (!edit) return;
    snapshot();
    let i = 1;
    while (nodes.some((n) => n.id === t + "_" + i)) i++;
    const id = t + "_" + i;
    const cfg: Record<string, unknown> = t === "condition" ? { field: "type", op: "eq", value: "igf" } : t === "notify" ? { to: "pic", template: "assigned" } : t === "assign_owner" ? { role: "producer" } : t === "human_approval" ? { kind: "creative_review" } : {};
    setNodes((ns) => [...ns, { id, type: "auto", position: pos ?? { x: 260, y: 80 + ns.length * 40 }, data: { type: t, cfg } }]);
    setSel(id);
  };
  const selNode = nodes.find((n) => n.id === selId) ?? null;
  const run = (f: () => Promise<{ ok: boolean; message?: string } & Record<string, unknown>>, ok: string) => start(async () => { const r = await f(); setMsg(r.ok ? ok : (r as { message: string }).message); if (r.ok) onSaved(); });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E7E9EC] bg-white px-3 py-2">
        <WfIcon className="size-4 text-[#2F6FEB]" />
        <span className="text-[14px] font-semibold">{wf.name}</span>
        <Tag s={wf.status} />
        <span className="text-[12px] text-[#73777F]">{wf.activeVersion ? "versi terbit v" + wf.activeVersion : "belum terbit"} · draf r{rev}{wf.updatedBy ? " · " + wf.updatedBy : ""}{dirty ? " · belum disimpan" : ""}</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {edit && <><Button variant="ghost" size="icon-sm" onClick={undo} disabled={!hist.past.length} aria-label="Undo"><Undo2 /></Button><Button variant="ghost" size="icon-sm" onClick={redo} disabled={!hist.future.length} aria-label="Redo"><Redo2 /></Button></>}
          {edit && <Button variant="outline" size="sm" disabled={pending || !dirty} onClick={() => run(async () => { const r = await saveDraft(wf.key, graph, rev); if (r.ok) { setRev(r.data.rev); setBase(stableJson(graph)); setSavedG(graph); } return r; }, "Draf disimpan.")}><Save />Save draft</Button>}
          {edit && dirty && <Button variant="ghost" size="sm" disabled={pending} title="Kembalikan diagram ke draf terakhir yang tersimpan" onClick={() => { if (!window.confirm("Batalkan semua perubahan yang belum disimpan?")) return; snapshot(); restore(savedG); setSel(null); setMsg("Perubahan dibatalkan: kembali ke draf tersimpan."); }}><RotateCcw />Batalkan perubahan</Button>}
          {perms.test && (
            <>
              <select className={sel + " !h-8 !w-56"} value={card} onChange={(e) => setCard(e.target.value)} aria-label="Kartu untuk uji coba"><option value="">Kartu untuk Test Run…</option>{cards.map((c) => <option key={c.id} value={c.id}>{c.type.toUpperCase()} · {c.title} · {c.status}</option>)}</select>
              <Button variant="outline" size="sm" disabled={!!testWhy} title={testWhy || "Uji coba: tidak mengubah kartu dan tidak mengirim notifikasi"} onClick={() => start(async () => { const r = await testWorkflow(wf.key, card); if (r.ok) { setTest(r.data); setMsg("Test Run selesai: " + (ST[r.data.status]?.[0] ?? r.data.status) + " (tanpa efek samping)."); } else setMsg(r.message); })}><Play />Test Run</Button>
            </>
          )}
          {perms.publish && <Button size="sm" disabled={pending || dirty || issues.length > 0 || needs.length > 0} title={dirty ? "Simpan draf dulu" : needs.length ? "Aturan belum dikonfigurasi" : issues.length ? "Graf belum valid" : ""} onClick={() => run(() => publishWorkflow(wf.key, rev), "Versi baru diterbitkan.")}>Publish</Button>}
          {perms.publish && wf.status === "published" && <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => disableWorkflow(wf.key), "Workflow dinonaktifkan.")}>Disable</Button>}
        </div>
      </div>
      {perms.test && (
        <p className="-mt-1 px-1 text-[12px] text-[#73777F]">
          {testWhy && !pending ? <><b className="text-[#B7791F]">Test Run belum bisa:</b> {testWhy} </> : null}
          Test Run hanya simulasi pada draf tersimpan: tidak mengubah kartu, tidak mengisi PIC, dan tidak mengirim notifikasi/WhatsApp (hanya tercatat di Audit Log).
        </p>
      )}
      {(msg || issues.length > 0 || needs.length > 0) && (
        <div className="grid gap-1 rounded-xl border border-[#E7E9EC] bg-white px-3 py-2 text-[12.5px]">
          {msg && <p className="text-[#202124]">{msg}</p>}
          {issues.length > 0 && <p className="text-red-600">Validasi: {issues.map((i) => i.msg).join(" · ")}</p>}
          {needs.length > 0 && <p className="text-orange-700">Needs configuration: {needs.map((n) => POLICIES[n.key as PolicyKey]?.l ?? n.key).join(", ")}{needs.some((n) => n.blocked) ? " (butuh definisi bisnis baru)" : ""}. Publish dinonaktifkan sampai aturan aktif.</p>}
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_280px]">
        <div className="hidden rounded-xl border border-[#E7E9EC] bg-white p-2 lg:block">
          <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#73777F]">Node</p>
          {(Object.keys(NODE_TYPES) as NodeType[]).filter((t) => t !== "trigger").map((t) => { const { I, c } = IC[t]; return (
            <button key={t} type="button" draggable={edit} disabled={!edit} onDragStart={(e) => e.dataTransfer.setData("application/x-node", t)} onClick={() => addNode(t)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[12.5px] hover:bg-[#F3F4F6] disabled:opacity-50">
              <span className="grid size-5 place-items-center rounded" style={{ background: c + "1a", color: c }}><I className="size-3" /></span>{NODE_TYPES[t]}
            </button>); })}
        </div>
        <div className="h-[560px] overflow-hidden rounded-xl border border-[#E7E9EC] bg-[#F8F9FA]" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const t = e.dataTransfer.getData("application/x-node") as NodeType; if (t) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); addNode(t, { x: e.clientX - r.left - 115, y: e.clientY - r.top - 30 }); } }}>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={edit ? onNodesChange : undefined} onEdgesChange={edit ? (c) => { if (c.some((x) => x.type === "remove")) snapshot(); onEdgesChange(c); } : undefined}
            onConnect={onConnect} onNodeClick={(_, n) => setSel(n.id)} onPaneClick={() => setSel(null)} onNodeDragStart={() => edit && snapshot()} nodesDraggable={edit} nodesConnectable={edit} deleteKeyCode={edit ? ["Backspace", "Delete"] : null} fitView proOptions={{ hideAttribution: true }}>
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#D4D7DC" />
            <MiniMap pannable zoomable className="!rounded-lg !border !border-[#E7E9EC]" nodeColor={(n) => IC[(n.data as ND).type]?.c ?? "#999"} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <div className="grid content-start gap-3">
          <div className="rounded-xl border border-[#E7E9EC] bg-white p-3">
            <Inspector node={selNode} edit={edit} onChange={(cfg) => { snapshot(); setNodes((ns) => ns.map((n) => (n.id === selId ? { ...n, data: { ...n.data, cfg } } : n))); }} onDelete={() => { snapshot(); setNodes((ns) => ns.filter((n) => n.id !== selId)); setEdges((es) => es.filter((e) => e.source !== selId && e.target !== selId)); setSel(null); }} />
          </div>
          {test && (
            <div className="rounded-xl border border-[#E7E9EC] bg-white p-3">
              <p className="mb-1 flex items-center gap-2 text-[13px] font-semibold">Test Run <Tag s={test.status} /></p>
              <ol className="grid gap-1 text-[12px]">{test.steps.map((s, i) => <li key={i} className="flex items-start gap-1.5"><CircleDot className="mt-0.5 size-3 shrink-0 text-[#2F6FEB]" /><span><b>{s.nodeId}</b> · {ST[s.status]?.[0] ?? s.status}{s.handle ? " → " + s.handle : ""}<br /><span className="text-[#73777F]">{JSON.stringify(s.result)}</span></span></li>)}</ol>
            </div>
          )}
          {wf.versions.length > 0 && (
            <div className="rounded-xl border border-[#E7E9EC] bg-white p-3 text-[12px]">
              <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold"><History className="size-3.5" />Versi terbit</p>
              {wf.versions.map((v) => <p key={v.version} className="text-[#73777F]">v{v.version} · {v.publishedBy} · {new Date(v.publishedAt).toLocaleString("id-ID")} · {v.hash}</p>)}
            </div>
          )}
        </div>
      </div>
      <p className="text-[12px] text-[#73777F] lg:hidden">Di layar kecil kanvas hanya untuk dilihat; ubah workflow dari laptop.</p>
    </div>
  );
}

function PolicyCard({ p, edit, onSaved }: { p: Policy; edit: boolean; onSaved: (p: Policy) => void }) {
  const [c, setC] = useState<Record<string, unknown>>(p.config);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const meta = POLICIES[p.key];
  const blocked = p.key === "campaign.master";
  const offs = (c.offsetsHours as number[] | undefined) ?? [];
  const days = (c.days as number[] | undefined) ?? [];
  const inp = "h-8 rounded-md border border-[#E7E9EC] bg-white px-2 text-[13px]";
  return (
    <div className="grid gap-2 rounded-xl border border-[#E7E9EC] bg-white p-4">
      <div className="flex items-center gap-2"><span className="text-[14px] font-semibold">{meta.l}</span><Tag s={p.status} />{p.version > 0 && <span className="text-[11px] text-[#73777F]">v{p.version}</span>}</div>
      <p className="text-[12.5px] text-[#73777F]">{meta.d}</p>
      {p.key === "assignment.mapping" && <label className="flex items-center gap-2 text-[13px]"><input type="radio" disabled={!edit} checked={c.source === "jobdesk"} onChange={() => setC({ source: "jobdesk" })} />Pakai jobdesk FlowSpace (PIC utama per jenis konten)</label>}
      {p.key === "notify.channel" && <div className="flex gap-4 text-[13px]">{[["app", "Aplikasi (lonceng + push)"], ["app_wa", "Aplikasi + WhatsApp"]].map(([k, l]) => <label key={k} className="flex items-center gap-2"><input type="radio" disabled={!edit} checked={c.channel === k} onChange={() => setC({ channel: k })} />{l}</label>)}</div>}
      {p.key === "reminder.schedule" && (
        <div className="grid gap-2 text-[13px]">
          <label className="flex items-center gap-2">Jam batas Deadline Ready (WIB) <input type="time" disabled={!edit} className={inp} value={String(c.deadlineTime ?? "")} onChange={(e) => setC({ ...c, deadlineTime: e.target.value })} /></label>
          <div className="flex flex-wrap items-center gap-2">Kirim pengingat {[0, 1, 2].map((i) => <input key={i} type="number" min={1} max={168} disabled={!edit} placeholder="jam" className={inp + " w-20"} value={offs[i] ?? ""} onChange={(e) => { const o = [...offs]; o[i] = Number(e.target.value); setC({ ...c, offsetsHours: o.filter((x) => x > 0) }); }} />)} jam sebelumnya</div>
          <label className="flex items-center gap-2"><input type="radio" disabled={!edit} checked={c.recipients === "pic"} onChange={() => setC({ ...c, recipients: "pic" })} />Ke PIC kartu</label>
        </div>
      )}
      {p.key === "performance.checkpoints" && (
        <div className="grid gap-2 text-[13px]">
          <div className="flex gap-3">{[1, 7, 30].map((d) => <label key={d} className="flex items-center gap-1.5"><input type="checkbox" disabled={!edit} checked={days.includes(d)} onChange={(e) => setC({ ...c, days: e.target.checked ? [...days, d].sort((a, b) => a - b) : days.filter((x) => x !== d) })} />D+{d}</label>)}</div>
          <label className="flex items-center gap-2">Jam kirim (WIB) <input type="time" disabled={!edit} className={inp} value={String(c.sendTime ?? "")} onChange={(e) => setC({ ...c, sendTime: e.target.value })} /></label>
          <label className="flex items-center gap-2">Penerima <select disabled={!edit} className={inp} value={String(c.recipients ?? "")} onChange={(e) => setC({ ...c, recipients: e.target.value })}><option value="">Pilih…</option>{Object.entries(RECIPIENTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <p className="text-[12px] text-[#73777F]">Hanya pengingat untuk mencatat metrik di tab CPR. Tidak ada data analitik yang diambil otomatis (belum ada integrasi Meta).</p>
        </div>
      )}
      {blocked && <p className="text-[12.5px] text-orange-700">Diblokir: tentukan dulu definisi campaign (data, target, PIC) sebelum workflow campaign bisa aktif.</p>}
      {edit && !blocked && (
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await savePolicy(p.key, "active", c); setMsg(r.ok ? "Aktif." : r.message); if (r.ok) onSaved(r.data); })}>Aktifkan</Button>
          {p.status === "active" && <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { const r = await savePolicy(p.key, "disabled", c); setMsg(r.ok ? "Dinonaktifkan." : r.message); if (r.ok) onSaved(r.data); })}>Nonaktifkan</Button>}
          {msg && <span className="text-[12px] text-[#73777F]">{msg}</span>}
        </div>
      )}
    </div>
  );
}

/** Bila halaman ini tertanam di Studio (iframe), buka Detail kartu di Studio induk tanpa memuat ulang. */
function openInStudio(e: React.MouseEvent, id: string, tab: string) {
  if (typeof window !== "undefined" && window.parent !== window) {
    e.preventDefault();
    window.parent.postMessage({ type: "ts-open-card", id, tab }, window.location.origin);
  }
}

const TABS = [["list", "Workflows", WfIcon], ["builder", "Builder", GitBranch], ["runs", "Runs", Play], ["inbox", "Approval Inbox", Inbox], ["audit", "Audit Log", History], ["config", "Konfigurasi", Settings2]] as const;
type TabK = (typeof TABS)[number][0];

export function AutomationClient({ initial }: { initial: Init }) {
  const [d, setD] = useState(initial);
  const [tab, setTab] = useState<TabK>("list");
  const [key, setKey] = useState(initial.workflows[0]?.key ?? "");
  const [runs, setRuns] = useState<Extract<Awaited<ReturnType<typeof loadRuns>>, { ok: true }>["data"] | null>(null);
  const [inbox, setInbox] = useState<Extract<Awaited<ReturnType<typeof loadApprovals>>, { ok: true }>["data"] | null>(null);
  const [audit, setAudit] = useState<Extract<Awaited<ReturnType<typeof loadAudit>>, { ok: true }>["data"] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const p = d.perms;
  const reload = () => void loadAutomation().then((r) => r.ok && setD(r.data));
  useEffect(() => {
    if (tab === "runs" && p.runs) void loadRuns().then((r) => r.ok && setRuns(r.data));
    if (tab === "inbox" && p.approvals) void loadApprovals().then((r) => r.ok && setInbox(r.data));
    if (tab === "audit" && p.audit) void loadAudit().then((r) => r.ok && setAudit(r.data));
  }, [tab, p.runs, p.approvals, p.audit]);
  const wf = d.workflows.find((w) => w.key === key);
  const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#73777F]";
  const td = "px-3 py-2.5 align-top text-[13px]";
  const when = (s: string) => new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="mx-auto grid max-w-[1400px] gap-4 p-4 text-[#202124] md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-[#73777F]">Media · Workflow Automation</p>
          <h1 className="text-[22px] font-semibold tracking-tight">Otomasi</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={"rounded-md border px-2 py-1 text-[12px] " + (d.enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#E7E9EC] bg-white text-[#73777F]")}>
            {d.enabled ? "Worker otomasi: aktif" : "Worker otomasi: mati · event tetap dicatat"}{d.envForced ? " (dipaksa .env)" : ""}
          </span>
          {p.publish && !d.envForced && (
            <Button size="sm" variant={d.enabled ? "outline" : "default"} onClick={() => { if (d.enabled || confirm("Nyalakan worker otomasi? Hanya workflow yang sudah terbit dengan aturan aktif yang dijalankan.")) void setWorker(!d.enabled).then((r) => r.ok && setD((x) => ({ ...x, enabled: r.data.enabled }))); }}>
              {d.enabled ? "Matikan worker" : "Nyalakan worker"}
            </Button>
          )}
        </div>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-[#E7E9EC]" role="tablist">
        {TABS.filter(([k]) => (k === "audit" ? p.audit : k === "config" ? p.read : true)).map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={"-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium " + (tab === k ? "border-[#2F6FEB] text-[#202124]" : "border-transparent text-[#73777F] hover:text-[#202124]")}><I className="size-3.5" />{l}</button>
        ))}
      </nav>

      {tab === "list" && (
        <div className="overflow-x-auto rounded-xl border border-[#E7E9EC] bg-white">
          <table className="w-full min-w-[720px]"><thead className="border-b border-[#E7E9EC] bg-[#F8F9FA]"><tr><th className={th}>Workflow</th><th className={th}>Status</th><th className={th}>Validasi</th><th className={th}>Aturan bisnis</th><th className={th}></th></tr></thead>
            <tbody>{d.workflows.map((w) => (
              <tr key={w.key} className="border-b border-[#E7E9EC] last:border-0 hover:bg-[#F8F9FA]">
                <td className={td}><b className="font-semibold">{w.module} · {w.name}</b><br /><span className="text-[12px] text-[#73777F]">{EVENT_TYPES[w.draft.nodes.find((n) => n.type === "trigger")?.data.event as keyof typeof EVENT_TYPES] ?? ""}</span></td>
                <td className={td}><Tag s={w.status} />{w.activeVersion ? <span className="ml-1 text-[12px] text-[#73777F]">v{w.activeVersion}</span> : null}</td>
                <td className={td}>{w.issues.length ? <span className="text-red-600">{w.issues.length} masalah</span> : <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="size-3.5" />Valid</span>}</td>
                <td className={td}>{w.needs.map((n) => <div key={n.key} className="flex items-center gap-1.5 text-[12px]"><Tag s={n.ready ? "active" : "needs_configuration"} />{POLICIES[n.key as PolicyKey]?.l}</div>)}</td>
                <td className={td}><Button variant="outline" size="sm" onClick={() => { setKey(w.key); setTab("builder"); }}>Buka Builder</Button></td>
              </tr>))}</tbody></table>
        </div>
      )}

      {tab === "builder" && wf && (
        <>
          <div className="flex flex-wrap gap-1">{d.workflows.map((w) => <button key={w.key} onClick={() => setKey(w.key)} className={"rounded-md border px-2.5 py-1 text-[12.5px] " + (w.key === key ? "border-[#2F6FEB] bg-[#2F6FEB]/10 text-[#2F6FEB]" : "border-[#E7E9EC] bg-white")}>{w.module} · {w.name}</button>)}</div>
          <ReactFlowProvider key={wf.key + ":" + wf.draftRev + ":" + wf.status}><Builder wf={wf} perms={p} policies={d.policies} onSaved={reload} /></ReactFlowProvider>
        </>
      )}

      {tab === "runs" && (
        <div className="overflow-x-auto rounded-xl border border-[#E7E9EC] bg-white">
          {!runs ? <p className="p-4 text-[13px] text-[#73777F]">Memuat…</p> : !runs.length ? <p className="p-4 text-[13px] text-[#73777F]">Belum ada run. Run muncul setelah workflow terbit dan worker aktif.</p> : (
            <table className="w-full min-w-[760px]"><thead className="border-b border-[#E7E9EC] bg-[#F8F9FA]"><tr><th className={th}>Mulai</th><th className={th}>Workflow</th><th className={th}>Kartu</th><th className={th}>Status</th><th className={th}>Run ID</th></tr></thead>
              <tbody>{runs.map((r) => (
                <Fragment key={r.id}>
                  <tr onClick={() => setOpen(open === r.id ? null : r.id)} className="cursor-pointer border-b border-[#E7E9EC] hover:bg-[#F8F9FA]">
                    <td className={td}>{when(r.startedAt)}</td><td className={td}>{r.workflowKey} v{r.version}</td><td className={td}>{r.title}</td><td className={td}><Tag s={r.status} />{r.error && <span className="ml-1 text-[12px] text-red-600">{r.error}</span>}</td><td className={td + " font-mono text-[11px] text-[#73777F]"}>{r.id}</td>
                  </tr>
                  {open === r.id && <tr><td colSpan={5} className="bg-[#F8F9FA] px-4 py-2"><ol className="grid gap-1 text-[12px]">{r.steps.map((s, i) => <li key={i}><b>{s.nodeId}</b> · {ST[s.status]?.[0] ?? s.status}{s.handle ? " → " + s.handle : ""} · {when(s.at)} <span className="text-[#73777F]">{JSON.stringify(s.result)}</span></li>)}</ol></td></tr>}
                </Fragment>))}</tbody></table>
          )}
        </div>
      )}

      {tab === "inbox" && (
        <div className="overflow-x-auto rounded-xl border border-[#E7E9EC] bg-white">
          {!inbox ? <p className="p-4 text-[13px] text-[#73777F]">Memuat…</p> : !inbox.length ? <p className="p-4 text-[13px] text-[#73777F]">Tidak ada yang menunggu keputusan.</p> : (
            <table className="w-full min-w-[680px]"><thead className="border-b border-[#E7E9EC] bg-[#F8F9FA]"><tr><th className={th}>Kartu</th><th className={th}>Menunggu</th><th className={th}>Sejak</th><th className={th}></th></tr></thead>
              <tbody>{inbox.map((a) => (
                <tr key={a.id + a.kind} className="border-b border-[#E7E9EC] last:border-0">
                  <td className={td}><b>{a.title}</b><br /><span className="font-mono text-[11px] text-[#73777F]">{a.cprId}</span></td>
                  <td className={td}>{a.kind === "review" ? "Creative Review v" + a.ver : "Content Brief v" + a.ver}{a.waitingRun && <span className="ml-1"><Tag s="waiting_for_human" /></span>}</td>
                  <td className={td}>{when(a.since)}</td>
                  <td className={td}><a className="text-[13px] font-medium text-[#2F6FEB] hover:underline" href={"/studio/?p=pipeline&card=" + encodeURIComponent(a.id) + "&tab=" + (a.kind === "review" ? "qa" : "brief")} target="_top" onClick={(e) => openInStudio(e, a.id, a.kind === "review" ? "qa" : "brief")}>Putuskan di Studio →</a></td>
                </tr>))}</tbody></table>
          )}
          <p className="border-t border-[#E7E9EC] px-3 py-2 text-[12px] text-[#73777F]">Keputusan dibuat di Detail kartu (Creative Review / Content Brief) dengan izin & aturan yang sama. Lolos Creative Review tidak pernah otomatis berarti disetujui.</p>
        </div>
      )}

      {tab === "audit" && (
        <div className="overflow-x-auto rounded-xl border border-[#E7E9EC] bg-white">
          {!audit ? <p className="p-4 text-[13px] text-[#73777F]">Memuat…</p> : !audit.length ? <p className="p-4 text-[13px] text-[#73777F]">Belum ada catatan.</p> : (
            <table className="w-full min-w-[760px]"><thead className="border-b border-[#E7E9EC] bg-[#F8F9FA]"><tr><th className={th}>Waktu</th><th className={th}>Pelaku</th><th className={th}>Aksi</th><th className={th}>Objek</th><th className={th}>Hasil</th></tr></thead>
              <tbody>{audit.map((a) => <tr key={a.id} className="border-b border-[#E7E9EC] last:border-0"><td className={td}>{when(a.at)}</td><td className={td}>{a.actorId}</td><td className={td}>{a.action}</td><td className={td + " text-[12px]"}>{a.resourceType} · <span className="font-mono">{a.resourceId}</span></td><td className={td}>{a.outcome}</td></tr>)}</tbody></table>
          )}
        </div>
      )}

      {tab === "config" && (
        <div className="grid gap-3 md:grid-cols-2">
          {d.policies.map((pol) => <PolicyCard key={pol.key + pol.version} p={pol} edit={p.policy} onSaved={(np) => setD((x) => ({ ...x, policies: x.policies.map((q) => (q.key === np.key ? np : q)) }))} />)}
        </div>
      )}
      {!p.edit && <Badge variant="secondary" className="justify-self-start">Mode lihat saja: mengubah, menguji, dan menerbitkan hanya untuk admin penuh.</Badge>}
    </div>
  );
}
