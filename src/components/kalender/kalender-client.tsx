"use client";

import { useRouter } from "next/navigation";
import { EventManager, type Event } from "@/components/ui/event-manager";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/server/actions/calendar";
import { coverRequest } from "@/server/actions/requests";

const CATEGORIES = ["Agenda", "Rapat", "Deadline", "Pengingat", "Libur", "Cuti", "Izin", "Sakit", "Pengajuan"];
const TAGS = ["Penting", "Mendesak", "Kantor", "Tim", "Pribadi"];

const STUDIO_CATS = ["Syuting", "Deadline Ready", "Tayang"];
/** Di dalam Studio (iframe): buka Detail kartu FlowSpace di jendela Studio. */
function openStudioCard(id: string) {
  if (window.parent !== window) window.parent.postMessage({ type: "ts-open-card", id, tab: "det" }, window.location.origin);
  else window.open("/studio/?p=pipeline&card=" + encodeURIComponent(id), "_blank");
}

/** studio = tampil di Tirtonic Studio: ada filter jadwal konten & tombol Buka Detail kartu. */
export function KalenderClient({ events, studio = false }: { events: Event[]; studio?: boolean }) {
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
        filterCategories={studio ? STUDIO_CATS : undefined}
        onOpenCard={studio ? openStudioCard : undefined}
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
        onRequestRespond={async (id) => {
          const r = await coverRequest(id);
          if (!r.ok) alert(r.message);
          router.refresh();
        }}
      />
    </div>
  );
}
