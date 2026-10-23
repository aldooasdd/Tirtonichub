"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { markNotifRead, markAllNotifRead } from "@/server/actions/notifications";

type Row = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  time: string;
};

export function NotifClient({ notifications }: { notifications: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const hasUnread = notifications.some((n) => !n.read);

  function open(n: Row) {
    start(async () => {
      if (!n.read) await markNotifRead(n.id);
      if (n.link) router.push(n.link);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-24 font-semibold">Notifikasi</h1>
        {hasUnread && (
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => start(async () => {
              await markAllNotifRead();
              router.refresh();
            })}
          >
            Tandai semua dibaca
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {notifications.length === 0 && (
          <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">
            Belum ada notifikasi.
          </p>
        )}
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => open(n)}
            className="flex items-start gap-3 rounded-lg border bg-card p-4 text-left"
          >
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-brand"}`}
            />
            <div className="min-w-0">
              <p className={n.read ? "font-normal" : "font-semibold"}>{n.title}</p>
              {n.body && <p className="text-14 text-muted-foreground">{n.body}</p>}
              <p className="text-12 text-muted-foreground">{n.time}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
