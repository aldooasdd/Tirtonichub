import type { Prisma } from "@/generated/prisma";
import { requireStock } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const rupiah = new Intl.NumberFormat("id-ID");

export default async function StokPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireStock();
  const q = (await searchParams).q?.trim() ?? "";
  const like: Prisma.StringFilter = { contains: q, mode: "insensitive" };
  const rows = await prisma.rawProduct.findMany({
    where: {
      status: "STOCK",
      ...(q
        ? { OR: [{ name: like }, { sku: like }, { brand: like }, { color: like }, { supplier: like }] }
        : {}),
    },
    orderBy: { qcAt: "desc" },
    include: { qcBy: { select: { fullName: true } } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-24 font-semibold">Stok</h1>
      <form className="max-w-sm">
        <Input name="q" defaultValue={q} placeholder="Cari nama / SKU / merek / supplier…" />
      </form>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produk</TableHead>
              <TableHead>Varian</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Harga satuan</TableHead>
              <TableHead>Harga jual</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Diloloskan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Belum ada stok.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {[r.brand, r.color, r.size].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.sku ?? "—"}</TableCell>
                <TableCell>
                  {r.qty} {r.unit ?? "pcs"}
                </TableCell>
                <TableCell>Rp {rupiah.format(r.unitPrice)}</TableCell>
                <TableCell className="font-medium">{r.sellPrice != null ? `Rp ${rupiah.format(r.sellPrice)}` : "—"}</TableCell>
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
