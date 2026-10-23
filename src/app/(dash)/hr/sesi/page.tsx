import { requireHr } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { SesiClient } from "@/components/hr/sesi-client";

export default async function SesiPage() {
  await requireHr();
  const sessions = await prisma.session.findMany({
    where: { revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastActiveAt: "desc" },
    include: { user: { select: { fullName: true, email: true } } },
  });

  return (
    <SesiClient
      sessions={sessions.map((s) => ({
        id: s.id,
        userName: s.user.fullName,
        email: s.user.email,
        activeRole: s.activeRoleCode,
        userAgent: s.userAgent,
        ip: s.ip,
        lastActive: fmtWIB(s.lastActiveAt),
      }))}
    />
  );
}
