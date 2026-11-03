import { prisma } from "@/server/db";

/** id user → nama lengkap (mis. pelapor report). id kosong/terhapus → "-". */
export async function userNames(ids: (string | null | undefined)[]): Promise<(id: string | null | undefined) => string> {
  const uniq = [...new Set(ids.filter(Boolean) as string[])];
  const users = uniq.length ? await prisma.user.findMany({ where: { id: { in: uniq } }, select: { id: true, fullName: true } }) : [];
  const map = new Map(users.map((u) => [u.id, u.fullName]));
  return (id) => (id && map.get(id)) || "-";
}
