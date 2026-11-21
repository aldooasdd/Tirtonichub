// Validasi graf workflow (dipakai klien & server). Menolak node tak dikenal, cabang hilang, node tak terjangkau,
// siklus, field/nilai di luar daftar resmi, dan graf terlalu besar.

import { COND_FIELDS, COND_OPS, HANDLES, isEventType, MAX_NODES, NODE_TYPES, RECIPIENTS, TEMPLATES, type GEdge, type GNode, type Graph, type NodeType } from "./types";
import type { PolicyKey } from "./policies";

export type Issue = { nodeId?: string; msg: string };
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

/** Aturan bisnis yang dibutuhkan tiap jenis node. */
export const NODE_POLICY: Partial<Record<NodeType, PolicyKey[]>> = {
  assign_owner: ["assignment.mapping"],
  notify: ["notify.channel"],
  wait: ["reminder.schedule"],
  performance_eval: ["performance.checkpoints"],
  attach_campaign: ["campaign.master"],
};

function nodeDataWhy(n: GNode): string | null {
  const d = n.data ?? {};
  const keys = Object.keys(d).filter((k) => k !== "label");
  const only = (...ok: string[]) => (keys.every((k) => ok.includes(k)) ? null : "isian node tidak dikenal");
  switch (n.type) {
    case "trigger":
      return isEventType(d.event) ? only("event") : "pilih event pemicu";
    case "condition": {
      const f = COND_FIELDS[String(d.field)];
      if (!f) return "pilih field kondisi";
      if (!(String(d.op) in COND_OPS)) return "pilih operator";
      const vals = Array.isArray(d.value) ? d.value.map(String) : [String(d.value ?? "")];
      if (!vals.length || vals.some((v) => !f.values.includes(v))) return "nilai kondisi harus dari daftar " + f.l;
      if (d.op !== "in" && vals.length !== 1) return "operator ini butuh satu nilai";
      return only("field", "op", "value");
    }
    case "assign_owner":
      return ["producer", "editor"].includes(String(d.role)) ? only("role") : "pilih PIC Produksi / PIC Editing";
    case "notify":
      if (!(String(d.to) in RECIPIENTS)) return "pilih penerima";
      if (!(String(d.template) in TEMPLATES)) return "pilih template pesan";
      return only("to", "template");
    case "human_approval":
      return d.kind === "creative_review" ? only("kind") : "pilih jenis persetujuan";
    case "request_qa":
    case "wait":
    case "performance_eval":
    case "attach_campaign":
    case "end":
      return only();
  }
}

export function validateGraph(g: unknown): Issue[] {
  const out: Issue[] = [];
  const G = g as Graph;
  if (!G || !Array.isArray(G.nodes) || !Array.isArray(G.edges)) return [{ msg: "graf tidak valid" }];
  if (G.nodes.length === 0) return [{ msg: "graf kosong" }];
  if (G.nodes.length > MAX_NODES || G.edges.length > MAX_NODES * 3) out.push({ msg: "graf terlalu besar (maks. " + MAX_NODES + " node)" });
  const ids = new Set<string>();
  for (const n of G.nodes) {
    if (!n || !ID_RE.test(String(n.id)) || ids.has(n.id)) { out.push({ msg: "ID node tidak valid / ganda" }); continue; }
    ids.add(n.id);
    if (!(n.type in NODE_TYPES)) { out.push({ nodeId: n.id, msg: "jenis node tidak dikenal" }); continue; }
    const w = nodeDataWhy(n);
    if (w) out.push({ nodeId: n.id, msg: w });
  }
  const triggers = G.nodes.filter((n) => n.type === "trigger");
  if (triggers.length !== 1) out.push({ msg: "harus ada tepat satu Trigger" });
  if (!G.nodes.some((n) => n.type === "end")) out.push({ msg: "butuh minimal satu node End" });
  const outOf = new Map<string, GEdge[]>();
  for (const e of G.edges) {
    if (!e || !ids.has(e.source) || !ids.has(e.target)) { out.push({ msg: "garis menghubungkan node yang tidak ada" }); continue; }
    if (e.source === e.target) out.push({ nodeId: e.source, msg: "garis ke diri sendiri" });
    outOf.set(e.source, [...(outOf.get(e.source) ?? []), e]);
  }
  for (const n of G.nodes) {
    if (!(n.type in NODE_TYPES)) continue;
    const es = outOf.get(n.id) ?? [];
    const hs = HANDLES[n.type];
    if (n.type === "end") { if (es.length) out.push({ nodeId: n.id, msg: "End tidak boleh punya garis keluar" }); continue; }
    if (hs) {
      for (const h of hs) { const c = es.filter((e) => e.sourceHandle === h).length; if (c !== 1) out.push({ nodeId: n.id, msg: "cabang \"" + h + "\" harus tersambung tepat satu kali" }); }
      if (es.some((e) => !hs.includes(String(e.sourceHandle)))) out.push({ nodeId: n.id, msg: "cabang tidak dikenal" });
    } else if (es.length !== 1) out.push({ nodeId: n.id, msg: "butuh tepat satu garis keluar" });
  }
  if (triggers.length === 1) {
    // terjangkau dari Trigger & tanpa siklus (DFS)
    const seen = new Set<string>(), stack = new Set<string>();
    let cyc = false;
    const visit = (id: string) => {
      if (stack.has(id)) { cyc = true; return; }
      if (seen.has(id)) return;
      seen.add(id); stack.add(id);
      for (const e of outOf.get(id) ?? []) visit(e.target);
      stack.delete(id);
    };
    visit(triggers[0].id);
    if (cyc) out.push({ msg: "workflow tidak boleh berputar (siklus)" });
    for (const n of G.nodes) if (!seen.has(n.id)) out.push({ nodeId: n.id, msg: "node tidak terjangkau dari Trigger" });
    if (G.edges.some((e) => e.target === triggers[0].id)) out.push({ nodeId: triggers[0].id, msg: "Trigger tidak boleh menjadi tujuan garis" });
  }
  return out;
}

/** Aturan bisnis yang dibutuhkan graf ini. */
export const graphPolicies = (g: Graph): PolicyKey[] => [...new Set(g.nodes.flatMap((n) => NODE_POLICY[n.type] ?? []))];
