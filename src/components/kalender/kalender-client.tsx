"use client";

import { useRouter } from "next/navigation";
import { EventManager, type Event } from "@/components/ui/event-manager";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/server/actions/calendar";

const CATEGORIES = ["Agenda", "Rapat", "Deadline", "Pengingat", "Libur", "Cuti", "Izin", "Sakit", "Pengajuan"];
const TAGS = ["Penting", "Mendesak", "Kantor", "Tim", "Pribadi"];

export function KalenderClient({ events }: { events: Event[] }) {
  const router = useRouter();
  // key = sidik data server; berubah setelah refresh → remount, buang state optimistik.
  const key = events.map((e) => e.id).join("|");

  return (
    <div className="space-y-4">
      <h1 className="text-24 font-semibold">Kalender</h1>
      <EventManager
        key={key}
        events={events}
        categories={CATEGORIES}
        availableTags={TAGS}
        onEventCreate={async (ev) => {
          await createCalendarEvent({
            title: ev.title,
            description: ev.description ?? null,
            startTime: ev.startTime.toISOString(),
            endTime: ev.endTime.toISOString(),
            color: ev.color,
            category: ev.category ?? null,
            tags: ev.tags ?? [],
          });
          router.refresh();
        }}
        onEventUpdate={async (id, ev) => {
          await updateCalendarEvent(id, {
            title: ev.title,
            description: ev.description ?? undefined,
            startTime: ev.startTime?.toISOString(),
            endTime: ev.endTime?.toISOString(),
            color: ev.color,
            category: ev.category ?? undefined,
            tags: ev.tags,
          });
          router.refresh();
        }}
        onEventDelete={async (id) => {
          await deleteCalendarEvent(id);
          router.refresh();
        }}
      />
    </div>
  );
}
