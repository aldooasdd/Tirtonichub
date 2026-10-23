import { requireStock } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { QcClient } from "@/components/stock/qc-client";

export default async function QcPage() {
  await requireStock();
  const rows = await prisma.rawProduct.findMany({
    where: { status: "QC" },
    orderBy: { createdAt: "asc" },
    include: { createdBy: { select: { fullName: true } } },
  });

  return (
    <QcClient
      items={rows.map((r) => ({
        id: r.id,
        name: r.name,
        qty: r.qty,
        unit: r.unit,
        unitPrice: r.unitPrice,
        supplier: r.supplier,
        notaDate: r.notaDate ? r.notaDate.toISOString().slice(0, 10) : null,
        byName: r.createdBy.fullName,
      }))}
    />
  );
}
