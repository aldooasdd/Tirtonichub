"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import type { RoleCode } from "@/lib/roles";

export type RightNotif = { id: string; title: string; time: string; link: string | null };
export type RightMember = { id: string; name: string; role: RoleCode | null; active: boolean };

// Panel kanan: Notifikasi. (Anggota pindah ke popup chat / FloatingChat.)
export function RightPanel({ notifications }: { notifications: RightNotif[] }) {
  return (
    <aside className="hidden w-80 shrink-0 overflow-y-auto border-l bg-background p-5 lg:block">
      <h3 className="mb-4 text-14 font-semibold">Notifikasi</h3>
      <div className="flex flex-col gap-4">
        {notifications.length === 0 && <Empty>Belum ada notifikasi.</Empty>}
        {notifications.map((n) => (
          <Row key={n.id} icon={<Bell className="h-4 w-4" />} title={n.title} time={n.time} href={n.link} />
        ))}
      </div>
    </aside>
  );
}

function Row({
  icon,
  title,
  time,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  time: string;
  href?: string | null;
}) {
  const inner = (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-kpi-1 text-kpi-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-14">{title}</p>
        <p className="text-12 text-muted-foreground">{time}</p>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="-m-1 rounded-lg p-1 hover:bg-accent">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-14 text-muted-foreground">{children}</p>;
}
