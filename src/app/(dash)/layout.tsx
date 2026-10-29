import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { SessionProvider } from "@/components/layout/active-role-context";
import { AppShell } from "@/components/layout/app-shell";
import { RouteReveal } from "@/components/route-reveal";
import { Presence } from "@/components/presence";
import { prisma } from "@/server/db";
import { timeAgo } from "@/lib/datetime";
import { listRooms } from "@/server/chat/queries";
import { dateKeyWIB } from "@/server/attendance/logic";

export default async function DashLayout({ children }: LayoutProps<"/">) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.activeRole) redirect("/pilih-role");

  const [notifRows, memberRows, liveSessions, rooms, presenceRows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: s.user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true, link: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, roles: { select: { role: { select: { code: true } } } } },
    }),
    prisma.session.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      select: { userId: true, activeRoleCode: true, lastActiveAt: true },
    }),
    listRooms(s.user.id),
    prisma.attendance.findMany({
      where: { date: dateKeyWIB(new Date()), checkInAt: { not: null } },
      orderBy: { checkInAt: "asc" },
      include: { user: { select: { id: true, fullName: true } } },
    }),
    prisma.notification.count({ where: { userId: s.user.id, readAt: null } }),
  ]);

  const presence = presenceRows.map((a) => ({
    id: a.userId,
    name: a.user.fullName,
    late: a.status === "LATE",
  }));

  const notifications = notifRows.map((n) => ({
    id: n.id,
    title: n.title,
    link: n.link,
    time: timeAgo(n.createdAt),
  }));

  // Anggota: online = sesi dengan lastActiveAt < 150 dtk (heartbeat dari tab terbuka).
  // Role dari sesi aktif bila online, selain itu role pertama. Aktif → paling atas.
  const onlineSince = Date.now() - 150_000;
  const liveByUser = new Map(
    liveSessions
      .filter((v) => v.lastActiveAt.getTime() > onlineSince)
      .map((v) => [v.userId, v.activeRoleCode]),
  );
  const members = memberRows
    .map((u) => ({
      id: u.id,
      name: u.fullName,
      role: liveByUser.get(u.id) ?? u.roles[0]?.role.code ?? null,
      active: liveByUser.has(u.id),
    }))
    .sort((a, b) => Number(b.active) - Number(a.active));

  return (
    <SessionProvider
      user={{ fullName: s.user.fullName, email: s.user.email }}
      role={s.activeRole}
      roles={s.roles}
    >
      <AppShell
        notifications={notifications}
        members={members}
        rooms={rooms}
        presence={presence}
        me={s.user.id}
        notifCount={unreadCount}
      >
        <RouteReveal>{children}</RouteReveal>
      </AppShell>
      <Presence />
    </SessionProvider>
  );
}
