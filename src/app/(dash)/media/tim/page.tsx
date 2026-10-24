import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { prisma } from "@/server/db";
import { MediaTimClient } from "@/components/media/media-tim-client";

export default async function MediaTimPage() {
  const ctx = await requireMedia();
  const acc = await mediaAccess(ctx);
  const users = await prisma.user.findMany({
    where: { isActive: true, roles: { some: { role: { code: "MEDIA" } } } },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, mediaMember: true },
  });

  return (
    <MediaTimClient
      full={acc.full}
      members={users.map((u) => ({
        userId: u.id,
        name: u.fullName,
        code: u.mediaMember?.code ?? "",
        role: u.mediaMember?.role ?? "MEMBER",
        idcc: u.mediaMember?.idcc ?? false,
        offDays: u.mediaMember?.offDays ?? [],
        phone: u.mediaMember?.phone ?? "",
        exists: !!u.mediaMember,
      }))}
    />
  );
}
