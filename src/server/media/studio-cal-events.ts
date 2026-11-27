import { prisma } from "@/server/db";
import { IDX, TYPES, nm } from "@/lib/media/schedule";
import { isExpired, pausedOf } from "@/lib/media/card";
import { todayWIB } from "@/server/media/schedule-runner";
import type { Event } from "@/components/ui/event-manager";

/** Kategori jadwal konten Studio di Kalender (hanya dibaca; id berawalan ts_). */
export const STUDIO_CAL_CATS = ["Syuting", "Deadline Ready", "Tayang"];

const DAY = /^\d{4}-\d{2}-\d{2}$/;
function at(day: string, hhmm: string, addMin = 0): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), h || 0, (m || 0) + addMin, 0, 0);
}
const ex = (extra: unknown, k: string) => (extra && typeof extra === "object" ? (extra as Record<string, unknown>)[k] : undefined);

/** Jadwal kartu FlowSpace (Studio) sebagai event kalender: Syuting, Deadline Ready, Tayang. Tidak mengubah data. */
export async function studioCalEvents(): Promise<Event[]> {
  const today = todayWIB();
  const rows = await prisma.mediaTask.findMany({
    select: { id: true, type: true, title: true, status: true, producer: true, editor: true, shootPlan: true, readyBy: true, due: true, postAt: true, postTime: true, locked: true, metaAt: true, cprId: true, createdAt: true, extra: true },
  });
  const out: Event[] = [];
  for (const t of rows) {
    if (ex(t.extra, "suspendedAt") || ex(t.extra, "mergedInto")) continue;
    const lbl = TYPES[t.type]?.label ?? t.type;
    const idx = IDX[t.status] ?? 0;
    const desc = (extra: string) => [lbl, t.cprId, extra, "Tahap: " + t.status].filter(Boolean).join(" · ");
    if (t.status !== "Tayang" && isExpired({ id: t.id, status: t.status, createdAt: t.createdAt.getTime(), type: t.type, title: t.title, pausedMs: pausedOf(t.extra) }, today)) continue;
    if (t.shootPlan && DAY.test(t.shootPlan) && idx <= IDX["Diproduksi"])
      out.push({ id: `ts_s_${t.id}`, cardId: t.id, title: `Syuting · ${t.title}`, description: desc(t.producer ? "PIC " + nm(t.producer) : ""), startTime: at(t.shootPlan, "10:00"), endTime: at(t.shootPlan, "11:30"), color: "orange", category: "Syuting" });
    const due = t.readyBy || t.due;
    if (due && DAY.test(due) && idx < IDX["Ready"])
      out.push({ id: `ts_d_${t.id}`, cardId: t.id, title: `Deadline Ready · ${t.title}`, description: desc(t.editor ? "Editor " + nm(t.editor) : ""), startTime: at(due, "15:00"), endTime: at(due, "15:30"), color: "red", category: "Deadline Ready" });
    // tayang: hanya jadwal sungguhan (dikunci/Meta/Tayang, atau Video event & IDCC), bukan saran
    const real = t.locked || !!t.metaAt || t.status === "Tayang" || ["evt", "idc"].includes(t.type);
    if (t.postAt && DAY.test(t.postAt) && real) {
      const tm = t.postTime && /^\d{2}:\d{2}$/.test(t.postTime) ? t.postTime : "09:00";
      const done = t.status === "Tayang" || !!t.metaAt;
      out.push({ id: `ts_p_${t.id}`, cardId: t.id, title: `Tayang · ${t.title}`, description: desc(t.status === "Tayang" ? "Sudah tayang" : t.metaAt ? "Dijadwalkan di Meta" : "Direncanakan"), startTime: at(t.postAt, tm), endTime: at(t.postAt, tm, 30), color: done ? "green" : "blue", category: "Tayang" });
    }
  }
  return out;
}
