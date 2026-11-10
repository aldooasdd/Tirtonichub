import { requireHr } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { CabangClient } from "@/components/hr/cabang-client";

export default async function CabangPage() {
  await requireHr();
  const branches = await prisma.branch.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });
  return (
    <CabangClient
      branches={branches.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        latitude: b.latitude,
        longitude: b.longitude,
        userCount: b._count.users,
      }))}
    />
  );
}
