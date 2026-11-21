// Event bisnis diturunkan dari perubahan kartu (sebelum → sesudah). Fungsi murni; store.ts / media-tasks.ts menyimpan
// hasilnya ke AutomationEvent (outbox) DALAM transaksi yang sama dengan perubahan kartu.

import { randomUUID } from "node:crypto";
import type { AutoEvent, EventType } from "./types";

type Doc = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
const obj = (v: unknown): Doc => (v && typeof v === "object" && !Array.isArray(v) ? (v as Doc) : {});
const CPR = ["igf", "vpr", "vrv", "evt"];

export type NewEvent = Omit<AutoEvent, "id" | "occurredAt" | "correlationId"> & { dedupeKey: string };

/** Event dari satu perubahan kartu. dedupeKey = kunci unik per kejadian (mencegah event ganda saat tulis ulang). */
export function taskEvents(id: string, before: Doc | null, after: Doc | null): NewEvent[] {
  if (!after || !CPR.includes(s(after.type))) return [];
  const out: NewEvent[] = [];
  const ev = (type: EventType, key: string, payload: Doc) => out.push({ type, entityType: "task", entityId: id, payload: { type: s(after.type), ...payload }, dedupeKey: type + ":" + id + ":" + key });
  const bOk = obj(obj(before?.brief).ok), aOk = obj(obj(after.brief).ok);
  if (aOk.v && (Number(aOk.v) !== Number(bOk.v || 0) || s(aOk.at) !== s(bOk.at)))
    ev("cpr.ready_for_assignment.v1", "v" + s(aOk.v) + ":" + s(aOk.at), { briefV: Number(aOk.v) });
  const bq = obj(before?.qa), aq = obj(after.qa);
  if (aq.sys === 2) {
    if (aq.st === "submitted" && (bq.st !== "submitted" || Number(bq.ver) !== Number(aq.ver)))
      ev("production.submitted_for_qa.v1", "v" + s(aq.ver), { ver: Number(aq.ver) });
    const bl = Array.isArray(bq.log) ? bq.log.length : 0, al = Array.isArray(aq.log) ? aq.log.length : 0;
    const last = al > bl ? obj((aq.log as unknown[])[al - 1]) : {};
    if (last.act === "approve" || last.act === "review")
      ev("qa.completed.v1", "v" + s(aq.ver) + ":r" + s(aq.round), { ver: Number(aq.ver), result: last.act === "approve" ? "approved" : s(last.st) });
  }
  const dl = (d: Doc | null) => s(d?.readyBy || d?.due);
  if (before && (dl(before) !== dl(after) || s(before.producer) !== s(after.producer) || s(before.editor) !== s(after.editor) || s(before.status) !== s(after.status)))
    ev("task.deadline_changed.v1", [dl(after), s(after.producer), s(after.editor), s(after.status)].join("|"), { deadline: dl(after), status: s(after.status) });
  if (!before && dl(after)) ev("task.deadline_changed.v1", dl(after) + "|new", { deadline: dl(after), status: s(after.status) });
  if (s(after.campaignId) && s(after.campaignId) !== s(before?.campaignId)) ev("campaign.content_linked.v1", s(after.campaignId), { campaignId: s(after.campaignId) });
  if (after.status === "Tayang" && before?.status !== "Tayang") ev("content.published.v1", s(after.postAt) || "x", { postAt: s(after.postAt) });
  return out;
}

export const newCorrelationId = () => randomUUID();
