import { requireStock } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const rupiah = new Intl.NumberFormat("id-ID");

export default async function StokPage() {
  await requireStock();
  const rows = await prisma.rawProduct.findMany({
    where: { status: "STOCK" },
    orderBy: { qcAt: "desc" },
    include: { qcBy: { select: { fullName: true } } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-24 font-semibold">Stok</h1>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produk</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Harga satuan</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Diloloskan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Belum ada stok.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>
                  {r.qty} {r.unit ?? "pcs"}
                </TableCell>
                <TableCell>Rp {rupiah.format(r.unitPrice)}</TableCell>
                <TableCell className="text-muted-foreground">{r.supplier ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{r.qcBy?.fullName ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
