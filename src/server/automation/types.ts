// Workflow Automation (21 Nov 2026): tipe event, node, dan graf. Semua pilihan berasal dari daftar tetap (whitelist);
// tidak ada skrip, SQL, atau URL bebas yang bisa dijalankan dari node.

/** Event bisnis yang benar-benar ada di Studio (diturunkan dari perubahan kartu di store.ts / media-tasks.ts). */
export const EVENT_TYPES = {
  "cpr.ready_for_assignment.v1": "Content Brief disetujui (kartu boleh masuk produksi)",
  "production.submitted_for_qa.v1": "Creative Review diajukan",
  "qa.completed.v1": "Creative Review diputuskan (Approved / revisi)",
  "task.deadline_changed.v1": "Deadline Ready / PIC / tahap kartu berubah",
  "campaign.content_linked.v1": "Campaign ID kartu diisi/diubah",
  "content.published.v1": "Kartu pindah ke Tayang",
} as const;
export type EventType = keyof typeof EVENT_TYPES;
export const isEventType = (v: unknown): v is EventType => typeof v === "string" && v in EVENT_TYPES;

export type AutoEvent = {
  id: string; // eventId (unik)
  type: EventType;
  entityType: "task";
  entityId: string;
  payload: Record<string, unknown>; // hanya ID & metadata kecil, tanpa data pribadi
  correlationId: string;
  occurredAt: Date;
};

export const NODE_TYPES = {
  trigger: "Trigger",
  condition: "Condition",
  assign_owner: "Assign Owner (Update Task)",
  attach_campaign: "Attach to Campaign",
  request_qa: "Request Creative Review",
  human_approval: "Human Approval",
  notify: "Notification",
  wait: "Delay / Deadline",
  performance_eval: "Performance Evaluation",
  end: "End",
} as const;
export type NodeType = keyof typeof NODE_TYPES;

/** Field kartu yang boleh dicek di node Condition, beserta pilihan nilainya (dari daftar resmi yang sudah ada). */
export const COND_FIELDS: Record<string, { l: string; values: string[] }> = {
  type: { l: "Jenis konten", values: ["igf", "vpr", "vrv", "evt", "idc", "idf"] },
  status: { l: "Tahap", values: ["Terdata", "Diproduksi", "Editing", "Ready", "Tayang"] },
  briefReq: { l: "Wajib brief (kartu baru)", values: ["true", "false"] },
  primary: { l: "Primary Objective (brief)", values: ["AWR", "ENT", "QIN", "CNV", "RET"] },
  qaResult: { l: "Hasil Creative Review", values: ["approved", "revision", "major", "blocked"] },
  hasProducer: { l: "PIC Produksi terisi", values: ["true", "false"] },
  hasEditor: { l: "PIC Editing terisi", values: ["true", "false"] },
};
export const COND_OPS = { eq: "sama dengan", neq: "tidak sama dengan", in: "salah satu dari" } as const;

/** Template pesan notifikasi (teks tetap di server; tidak ada teks bebas dari node). */
export const TEMPLATES = {
  assigned: "Kartu siap diproduksi (brief disetujui)",
  review_pending: "Creative Review menunggu keputusan",
  review_revision: "Creative Review: perlu revisi",
  review_approved: "Creative Review: Approved",
  deadline_reminder: "Pengingat Deadline Ready",
  metrics_due: "Saatnya mencatat metrik konten",
} as const;
export type TemplateKey = keyof typeof TEMPLATES;
export const RECIPIENTS = { pic: "PIC kartu (produksi & editing)", creator: "Pembuat konten (produksi & editing)", reviewers: "Reviewer (admin & Admin 2)" } as const;

export type GNode = { id: string; type: NodeType; data: Record<string, unknown>; position?: { x: number; y: number } };
export type GEdge = { id: string; source: string; target: string; sourceHandle?: string | null };
export type Graph = { nodes: GNode[]; edges: GEdge[] };

/** Cabang keluar per jenis node. */
export const HANDLES: Partial<Record<NodeType, string[]>> = { condition: ["true", "false"], human_approval: ["approved", "revision"] };
export const MAX_NODES = 40;
