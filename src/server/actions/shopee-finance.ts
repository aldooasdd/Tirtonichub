"use server";

import { requireChannel } from "@/server/auth/rbac";
import { activeShop, fresh, DEMO } from "@/server/marketplace/sync";
import * as fin from "@/server/marketplace/shopee-finance";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Gagal.");
async function conn() {
  const shop = await activeShop("SHOPEE");
  if (!shop || shop.shopId === DEMO) throw new Error("Toko Shopee belum tersambung.");
  const s = await fresh(shop);
  return { token: s.accessToken, shopId: s.shopId };
}
/** "YYYY-MM-DD" (WIB) → detik epoch awal/akhir hari. */
const day = (iso: string, end = false) => Math.floor(new Date(`${iso}T${end ? "23:59:59" : "00:00:00"}+07:00`).getTime() / 1000);

export async function makeIncomeFile(kind: "report" | "weekly" | "monthly", from: string, to: string): Promise<{ ok: boolean; id?: string; message?: string }> {
  await requireChannel();
  try {
    const c = await conn();
    const id = kind === "report" ? await fin.generateIncomeReport(c, day(from), day(to, true)) : await fin.generateIncomeStatement(c, day(from), day(to, true), kind === "weekly" ? 1 : 2);
    return id ? { ok: true, id } : { ok: false, message: "Shopee tidak mengembalikan ID laporan." };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}

export async function checkIncomeFile(kind: "report" | "weekly" | "monthly", id: string): Promise<{ ok: boolean; file?: fin.ReportFile; message?: string }> {
  await requireChannel();
  try {
    const c = await conn();
    return { ok: true, file: kind === "report" ? await fin.incomeReport(c, id) : await fin.incomeStatement(c, id) };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}
