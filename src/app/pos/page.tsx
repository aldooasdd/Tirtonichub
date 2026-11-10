import type { Metadata } from "next";
import { prisma } from "@/server/db";
import { getPosBranch } from "@/server/pos";
import { PosLogin } from "@/components/pos/pos-login";
import { PosApp } from "@/components/pos/pos-app";
import { ROLE_LABELS } from "@/lib/roles";

export const metadata: Metadata = { title: "Kasir · Tirtonichub" };

export default async function PosPage() {
  const branch = await getPosBranch();
  if (!branch) return <PosLogin />;
  const users = await prisma.user.findMany({
    where: { branchId: branch.id, isActive: true },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, nickname: true, roles: { select: { role: { select: { code: true } } } } },
  });
  return (
    <PosApp
      branch={branch}
      users={users.map((u) => ({
        id: u.id,
        name: u.nickname || u.fullName,
        role: u.roles.map((r) => ROLE_LABELS[r.role.code]).join(", ") || "—",
      }))}
    />
  );
}
