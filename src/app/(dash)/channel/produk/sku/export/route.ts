import ExcelJS from "exceljs";
import { requireProduk } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { DEMO } from "@/server/marketplace/sync";
import { SKU_COLS } from "@/lib/sku-cols";

const TOKO: Record<string, string> = { SHOPEE: "Shopee", TOKOPEDIA: "Tokopedia", WEBSITE: "Tirtonic.com" };

/** Semua varian marketplace → Excel. Isi kolom "SKU Tirtonichub", lalu upload lagi di halaman Import SKU. */
export async function GET() {
  await requireProduk();
  const items = await prisma.marketplaceItem.findMany({
    where: { deletedAt: null, shopId: { not: DEMO } },
    orderBy: [{ name: "asc" }, { variant: "asc" }],
  });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("SKU");
  ws.columns = [
    { header: SKU_COLS.id, key: "id", width: 28 },
    { header: "Toko", key: "toko", width: 12 },
    { header: "Nama Produk", key: "nama", width: 60 },
    { header: "Varian", key: "varian", width: 28 },
    { header: "SKU Marketplace", key: "skuMp", width: 18 },
    { header: SKU_COLS.sku, key: "sku", width: 18 },
    { header: "Harga", key: "harga", width: 12 },
    { header: "Stok", key: "stok", width: 8 },
    { header: "Nonaktif", key: "non", width: 9 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const it of items)
    ws.addRow({
      id: it.id,
      toko: TOKO[it.platform] ?? it.platform,
      nama: it.localName ?? it.name,
      varian: it.variant ?? "",
      skuMp: it.sku ?? "",
      sku: it.localSku ?? it.sku ?? "",
      harga: it.price,
      stok: it.stock,
      non: it.skuStatus === "DEACTIVATED" ? "YA" : "",
    });
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sku-tirtonichub-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
