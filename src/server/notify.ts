import { prisma } from "@/server/db";

/** Kirim notifikasi ke semua Boss aktif. (Sementara: semua event masuk ke Boss.) */
export async function notifyBosses(n: {
  type: string;
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  const bosses = await prisma.userRole.findMany({
    where: { role: { code: "BOSS" }, user: { isActive: true } },
    select: { userId: true },
  });
  if (bosses.length === 0) return;
  await prisma.notification.createMany({
    data: bosses.map((b) => ({
      userId: b.userId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
    })),
  });
}
