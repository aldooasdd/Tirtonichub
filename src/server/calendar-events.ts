import { prisma } from "@/server/db";
import { REQ_TYPE_LABEL } from "@/lib/request-labels";
import type { Event } from "@/components/ui/event-manager";

// Date @db.Date disimpan UTC midnight → bangun Date lokal pada hari yang sama.
function atDay(d: Date, hour = 9): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, 0, 0, 0);
}
function eachDay(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  let t = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  while (t <= e) {
    out.push(new Date(t));
    t += 86_400_000;
  }
  return out;
}

const REQ_COLOR: Record<string, string> = { LEAVE: "blue", PERMIT: "orange", SICK: "purple" };

/** Gabungan event: manual (editable) + libur + cuti/izin/sakit (turunan, read-only). */
export async function loadCalendarEvents(): Promise<Event[]> {
  const [manual, holidays, requests] = await Promise.all([
    prisma.calendarEvent.findMany({ orderBy: { startTime: "asc" } }),
    prisma.holiday.findMany(),
    prisma.request.findMany({
      where: { type: { in: ["LEAVE", "PERMIT", "SICK"] }, status: { in: ["APPROVED", "PENDING"] } },
      include: { user: { select: { fullName: true } } },
    }),
  ]);

  const events: Event[] = [];

  for (const e of manual) {
    events.push({
      id: e.id,
      title: e.title,
      description: e.description ?? undefined,
      startTime: e.startTime,
      endTime: e.endTime,
      color: e.color,
      category: e.category ?? undefined,
      tags: e.tags,
    });
  }

  for (const h of holidays) {
    events.push({
      id: `hol_${h.id}`,
      title: h.name,
      startTime: atDay(h.date),
      endTime: atDay(h.date, 10),
      color: "red",
      category: "Libur",
    });
  }

  for (const r of requests) {
    const pending = r.status === "PENDING";
    for (const day of eachDay(r.startDate, r.endDate)) {
      events.push({
        id: `req_${r.id}_${day.toISOString().slice(0, 10)}`,
        title: `${REQ_TYPE_LABEL[r.type]} — ${r.user.fullName}${pending ? " (pending)" : ""}`,
        description: r.reason,
        startTime: atDay(day),
        endTime: atDay(day, 10),
        color: pending ? "pink" : (REQ_COLOR[r.type] ?? "blue"),
        category: pending ? "Pengajuan" : REQ_TYPE_LABEL[r.type],
      });
    }
  }

  return events;
}
