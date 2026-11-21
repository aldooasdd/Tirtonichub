// Lima workflow bawaan (draf awal, BELUM terbit). Admin penuh meninjau, mengubah, lalu menerbitkan di halaman Otomasi.
// Tidak ada PIC, jadwal, atau target yang ditanam di sini; nilai bisnis diambil dari aturan (policies) saat dijalankan.

import type { GEdge, GNode, Graph } from "./types";

const N = (id: string, type: GNode["type"], x: number, y: number, data: GNode["data"] = {}): GNode => ({ id, type, data, position: { x, y } });
const E = (s: string, t: string, h?: string): GEdge => ({ id: s + "-" + t + (h ? "-" + h : ""), source: s, target: t, sourceHandle: h ?? null });

export const TEMPLATES_WF: { key: string; name: string; module: string; graph: Graph }[] = [
  {
    key: "cpr-assignment",
    name: "CPR → Task Assignment",
    module: "A",
    graph: {
      nodes: [
        N("t", "trigger", 0, 0, { event: "cpr.ready_for_assignment.v1" }),
        N("c", "condition", 0, 130, { field: "hasProducer", op: "eq", value: "false" }),
        N("a", "assign_owner", -170, 260, { role: "producer" }),
        N("n", "notify", 0, 400, { to: "pic", template: "assigned" }),
        N("e", "end", 0, 530),
      ],
      edges: [E("t", "c"), E("c", "a", "true"), E("c", "n", "false"), E("a", "n"), E("n", "e")],
    },
  },
  {
    key: "qa-approval",
    name: "Creative Review → Human Approval",
    module: "B",
    graph: {
      nodes: [
        N("t", "trigger", 0, 0, { event: "production.submitted_for_qa.v1" }),
        N("q", "request_qa", 0, 130),
        N("n1", "notify", 0, 260, { to: "reviewers", template: "review_pending" }),
        N("h", "human_approval", 0, 390, { kind: "creative_review" }),
        N("ok", "notify", -170, 520, { to: "creator", template: "review_approved" }),
        N("rv", "notify", 170, 520, { to: "creator", template: "review_revision" }),
        N("e", "end", -170, 650),
        N("e2", "end", 170, 650),
      ],
      edges: [E("t", "q"), E("q", "n1"), E("n1", "h"), E("h", "ok", "approved"), E("h", "rv", "revision"), E("ok", "e"), E("rv", "e2")],
    },
  },
  {
    key: "deadline-reminder",
    name: "Deadline Reminder",
    module: "C",
    graph: {
      nodes: [N("t", "trigger", 0, 0, { event: "task.deadline_changed.v1" }), N("w", "wait", 0, 130), N("e", "end", 0, 260)],
      edges: [E("t", "w"), E("w", "e")],
    },
  },
  {
    key: "campaign",
    name: "Campaign Workflow",
    module: "D",
    graph: {
      nodes: [N("t", "trigger", 0, 0, { event: "campaign.content_linked.v1" }), N("a", "attach_campaign", 0, 130), N("e", "end", 0, 260)],
      edges: [E("t", "a"), E("a", "e")],
    },
  },
  {
    key: "performance",
    name: "Performance Monitoring",
    module: "E",
    graph: {
      nodes: [N("t", "trigger", 0, 0, { event: "content.published.v1" }), N("p", "performance_eval", 0, 130), N("e", "end", 0, 260)],
      edges: [E("t", "p"), E("p", "e")],
    },
  },
];
