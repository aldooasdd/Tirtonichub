import { requireAuth } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { NotifClient } from "@/components/notif-client";

export default async function NotifikasiPage() {
  const ctx = await requireAuth();
  const rows = await prisma.notification.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <NotifClient
      notifications={rows.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        link: n.link,
        read: n.readAt != null,
        time: fmtWIB(n.createdAt),
      }))}
    />
  );
}
