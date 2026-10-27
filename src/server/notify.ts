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

/** Kirim notifikasi ke Kepala Cabang aktif di cabang tertentu. */
export async function notifyBranchHeads(
  branchId: string | null,
  n: { type: string; title: string; body?: string; link?: string },
): Promise<void> {
  if (!branchId) return;
  const heads = await prisma.userRole.findMany({
    where: { role: { code: "HEAD_BRANCH" }, user: { isActive: true, branchId } },
    select: { userId: true },
  });
  if (heads.length === 0) return;
  await prisma.notification.createMany({
    data: heads.map((h) => ({
      userId: h.userId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
    })),
  });
}
