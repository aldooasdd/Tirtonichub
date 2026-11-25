import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { requireChannel } from "@/server/auth/rbac";
import { fmtWIB } from "@/lib/datetime";
import { loadTagData, selisih } from "@/server/rfid-data";

/** Data Tag → Excel: ringkasan per SKU + 1 baris per stiker. Mengikuti pencarian/filter halaman. */
export async function GET(req: NextRequest) {
  await requireChannel();
  const sp = req.nextUrl.searchParams;
  const { rows } = await loadTagData({ q: sp.get("q") ?? undefined, st: sp.get("st") ?? undefined });
  const wb = new ExcelJS.Workbook();
  const a = wb.addWorksheet("Per SKU");
  a.columns = [
    { header: "SKU", key: "sku", width: 20 }, { header: "Nama", key: "name", width: 60 }, { header: "Varian", key: "variant", width: 28 },
    { header: "Harga", key: "price", width: 14 }, { header: "Tag", key: "tag", width: 8 }, { header: "Stok sistem", key: "stock", width: 12 },
    { header: "Selisih", key: "diff", width: 10 }, { header: "Stok per cabang", key: "stocks", width: 40 }, { header: "Terakhir dipasang", key: "at", width: 22 },
  ];
  const b = wb.addWorksheet("Per Stiker");
  b.columns = [
    { header: "Kode stiker", key: "epc", width: 34 }, { header: "SKU", key: "sku", width: 20 }, { header: "Nama", key: "name", width: 60 },
    { header: "Varian", key: "variant", width: 28 }, { header: "Dipasang", key: "at", width: 22 }, { header: "Oleh", key: "by", width: 20 },
  ];
  for (const r of rows) {
    a.addRow({ sku: r.sku, name: r.name ?? "(tidak ada di Produk Master)", variant: r.variant, price: r.price, tag: r.tags.length, stock: r.stock, diff: selisih(r), stocks: r.stocks.map((s) => `${s.label} ${s.stock}`).join(", "), at: fmtWIB(r.tags[0].at) });
    for (const t of r.tags) b.addRow({ epc: t.epc, sku: r.sku, name: r.name, variant: r.variant, at: fmtWIB(t.at), by: t.by });
  }
  a.getColumn("price").numFmt = "#,##0";
  for (const ws of [a, b]) {
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  }
  return new Response(await wb.xlsx.writeBuffer(), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="data-tag-rfid.xlsx"',
    },
  });
}
