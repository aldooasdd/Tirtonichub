"use client";

import Link from "next/link";
import {
  Bell,
  MessageSquare,
  Crown,
  Camera,
  Receipt,
  Boxes,
  Users,
  Building2,
  TrendingUp,
  ClipboardList,
  User,
  type LucideIcon,
} from "lucide-react";
import { ROLE_LABELS, type RoleCode } from "@/lib/roles";

export type RightNotif = { id: string; title: string; time: string; link: string | null };
export type RightMember = { id: string; name: string; role: RoleCode | null; active: boolean };

const ROLE_ICONS: Record<RoleCode, LucideIcon> = {
  BOSS: Crown,
  MEDIA: Camera,
  FINANCE: Receipt,
  STOCK_ROOM: Boxes,
  HR: Users,
  HEAD_BRANCH: Building2,
  SALES: TrendingUp,
  ORDER_SPECIALIST: ClipboardList,
  ADMIN: User,
};

// Panel kanan: Notifikasi + Anggota (aktif di atas). Data dari layout.
export function RightPanel({
  notifications,
  members,
  onChat,
}: {
  notifications: RightNotif[];
  members: RightMember[];
  onChat: (m: { id: string; name: string }) => void;
}) {
  return (
    <aside className="hidden w-80 shrink-0 overflow-y-auto border-l bg-background p-5 lg:block">
      <h3 className="mb-4 text-14 font-semibold">Notifikasi</h3>
      <div className="mb-8 flex flex-col gap-4">
        {notifications.length === 0 && <Empty>Belum ada notifikasi.</Empty>}
        {notifications.map((n) => (
          <Row key={n.id} icon={<Bell className="h-4 w-4" />} title={n.title} time={n.time} href={n.link} />
        ))}
      </div>

      <h3 className="mb-4 text-14 font-semibold">Anggota</h3>
      <div className="flex flex-col gap-4">
        {members.length === 0 && <Empty>Belum ada anggota.</Empty>}
        {members.map((m) => {
          const Icon = m.role ? ROLE_ICONS[m.role] : User;
          return (
            <button
              key={m.id}
              onClick={() => onChat({ id: m.id, name: m.name })}
              title={`Chat ${m.name}`}
              className="group -m-1 flex items-center gap-3 rounded-lg p-1 text-left hover:bg-accent"
            >
              <div className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-kpi-1 text-kpi-foreground">
                <Icon className="h-4 w-4" />
                {m.active && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-14">{m.name}</p>
                <p className="text-12 text-muted-foreground">
                  {m.role ? ROLE_LABELS[m.role] : "Tanpa role"}
                </p>
              </div>
              <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          );
        })}
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
