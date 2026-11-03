import { requireHeadBranch } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { isSuperRole } from "@/lib/roles";
import { SETOR_AKUN } from "@/lib/rekening";
import { userNames } from "@/server/user-names";
import { SetorTunaiForm } from "@/components/cash/setor-tunai-form";

export default async function SetorTunaiPage() {
  const ctx = await requireHeadBranch();
  const isSuper = isSuperRole(ctx.activeRole);
  const [rows, branches] = await Promise.all([
    prisma.cashDeposit.findMany({
      where: isSuper ? {} : { branchId: ctx.branchId ?? "__none__" },
      orderBy: { depositedAt: "desc" },
      take: 100,
    }),
    isSuper
      ? prisma.branch.findMany({
          where: { NOT: { name: { contains: "office", mode: "insensitive" } } },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : null,
  ]);
  const nameOf = await userNames(rows.map((r) => r.createdById));

  return (
    <SetorTunaiForm
      akun={SETOR_AKUN}
      branches={branches}
      defaultBranchId={ctx.branchId ?? null}
      rows={rows.map((r) => ({ id: r.id, tgl: fmtWIB(r.depositedAt), branch: r.branchName, by: nameOf(r.createdById), amount: r.amount, photoKey: r.photoKey }))}
    />
  );
}
