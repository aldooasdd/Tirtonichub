import { requireCashoutInput } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { CashoutForm } from "@/components/cashout/cashout-form";

// Kategori nota per role. Finance punya daftar sendiri (nanti dibedakan lebih lanjut).
const SALES_CATS = ["Keperluan Kantor", "Ongkos Kirim"];
const FINANCE_CATS = ["Keperluan Kantor", "Ongkos Kirim"]; // ponytail: samakan dulu; ubah saat kebutuhan Finance jelas

export default async function PembelianPage() {
  const ctx = await requireCashoutInput();
  const categories = ctx.activeRole === "FINANCE" ? FINANCE_CATS : SALES_CATS;
  const rows = await prisma.cashout.findMany({
    where: { createdById: ctx.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <CashoutForm
      categories={categories}
      rows={rows.map((r) => ({
        id: r.id,
        spentAt: fmtWIB(r.spentAt),
        amount: r.amount,
        description: r.description,
        category: r.category,
        branch: r.branchName ?? "-",
        approved: r.approvedAt != null,
      }))}
    />
  );
}
