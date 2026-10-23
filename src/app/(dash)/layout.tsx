import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { SessionProvider } from "@/components/layout/active-role-context";
import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/server/db";
import { HR_ROLES } from "@/lib/roles";
import { timeAgo } from "@/lib/datetime";

export default async function DashLayout({ children }: LayoutProps<"/">) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.activeRole) redirect("/pilih-role");

  const [notifRows, actRows] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: s.user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true, link: true, createdAt: true },
    }),
    HR_ROLES.includes(s.activeRole)
      ? prisma.activityLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 6,
          include: { actor: { select: { fullName: true } } },
        })
      : [],
  ]);

  const notifications = notifRows.map((n) => ({
    id: n.id,
    title: n.title,
    link: n.link,
    time: timeAgo(n.createdAt),
  }));
  const activities = actRows.map((a) => ({
    id: a.id,
    text: `${a.actor.fullName} · ${a.action} ${a.entity}`,
    time: timeAgo(a.createdAt),
  }));

  return (
    <SessionProvider
      user={{ fullName: s.user.fullName, email: s.user.email }}
      role={s.activeRole}
      roles={s.roles}
    >
      <AppShell notifications={notifications} activities={activities}>
        {children}
      </AppShell>
    </SessionProvider>
  );
}
