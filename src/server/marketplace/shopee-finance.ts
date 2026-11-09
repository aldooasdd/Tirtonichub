// Keuangan Shopee (modul Payment): saldo penjual, penghasilan, billing, escrow, payout, laporan.
// Semua baca langsung dari Shopee (tidak disimpan). Uang dalam rupiah (float dari Shopee).
import { call } from "./shopee";

type C = { token: string; shopId: string };
const f = (v: unknown) => Number(v) || 0;

export type WalletTx = {
  time: number;
  type: string;
  title: string;
  amount: number;
  balance: number;
  status: string;
  orderSn: string;
  refundSn: string;
  buyer: string;
  reason: string;
  flow: string;
  fee: number;
};

/** Mutasi Saldo Penjual. Rentang maks 15 hari. */
export async function walletTransactions(c: C, from: number, to: number, opts: { flow?: "MONEY_IN" | "MONEY_OUT"; max?: number } = {}): Promise<WalletTx[]> {
  type T = {
    create_time: number;
    transaction_type: string;
    txn_title?: string;
    description?: string;
    amount: number;
    current_balance: number;
    status: string;
    order_sn?: string;
    refund_sn?: string;
    buyer_name?: string;
    reason?: string;
    money_flow?: string;
    transaction_fee?: number;
  };
  const out: WalletTx[] = [];
  for (let page = 0; page < 50 && out.length < (opts.max ?? 2000); page++) {
    const j = await call<{ response?: { transaction_list?: T[]; more?: boolean } }>("/api/v2/payment/get_wallet_transaction_list", {
      ...c,
      query: { page_no: page, page_size: 100, create_time_from: from, create_time_to: to, ...(opts.flow ? { money_flow: opts.flow } : {}) },
    });
    for (const t of j.response?.transaction_list ?? [])
      out.push({
        time: t.create_time,
        type: t.transaction_type,
        title: t.txn_title || t.description || "",
        amount: f(t.amount),
        balance: f(t.current_balance),
        status: t.status,
        orderSn: t.order_sn ?? "",
        refundSn: t.refund_sn ?? "",
        buyer: t.buyer_name ?? "",
        reason: t.reason ?? "",
        flow: t.money_flow ?? (f(t.amount) >= 0 ? "MONEY_IN" : "MONEY_OUT"),
        fee: f(t.transaction_fee),
      });
    if (!j.response?.more) break;
  }
  return out;
}

/** Ringkasan penghasilan: sudah dilepas & masih tertahan. income_status lokal: 1 Released, 2 Pending. */
export async function incomeOverview(c: C): Promise<{ released: number; pending: number }> {
  const get = (s: number) =>
    call<{ response?: { total_income?: { released_amount?: number; pending_amount?: number } } }>("/api/v2/payment/get_income_overview", { ...c, query: { income_status: s } });
  const [r, p] = await Promise.all([get(1), get(2)]);
  return { released: f(r.response?.total_income?.released_amount), pending: f(p.response?.total_income?.pending_amount) };
}

export type IncomeRow = { orderSn: string; desc: string; status: string; method: string; estimated: number; released: number; created: number; estPayout: number; paidAt: number };

/** Rincian penghasilan per order. status 1 = sudah dilepas (pakai rentang tanggal), 2 = tertahan (semua). */
export async function incomeDetail(c: C, status: 1 | 2, dateFrom: string, dateTo: string, max = 1000): Promise<IncomeRow[]> {
  type I = {
    order_sn: string;
    description?: string;
    status?: string;
    payment_method?: string;
    estimated_escrow_amount?: number;
    released_amount?: number;
    creation_date?: number;
    estimated_payout_time?: number;
    actual_payout_time?: number;
  };
  type R = { response?: { income_detail_list?: I[] | { income_detail_list_item?: I[] }; next_page?: { cursor?: string } } } & {
    income_detail_list?: { income_detail_list_item?: I[]; next_page?: { cursor?: string } };
  };
  const out: IncomeRow[] = [];
  let cursor = "";
  for (let i = 0; i < 20 && out.length < max; i++) {
    const j = await call<R>("/api/v2/payment/get_income_detail", { ...c, query: { date_from: dateFrom, date_to: dateTo, income_status: status, cursor, page_size: 100 } });
    // Bentuk respons di dokumen tidak konsisten → terima dua-duanya.
    const box = (j.response ?? j.income_detail_list ?? {}) as { income_detail_list?: unknown; income_detail_list_item?: I[]; next_page?: { cursor?: string } };
    const inner = box.income_detail_list as { income_detail_list_item?: I[]; next_page?: { cursor?: string } } | I[] | undefined;
    const items: I[] = Array.isArray(inner) ? inner : (inner?.income_detail_list_item ?? box.income_detail_list_item ?? []);
    for (const x of items)
      out.push({
        orderSn: x.order_sn,
        desc: x.description ?? "",
        status: x.status ?? "",
        method: x.payment_method ?? "",
        estimated: f(x.estimated_escrow_amount),
        released: f(x.released_amount),
        created: f(x.creation_date),
        estPayout: f(x.estimated_payout_time),
        paidAt: f(x.actual_payout_time),
      });
    cursor = (Array.isArray(inner) ? undefined : inner?.next_page?.cursor) ?? box.next_page?.cursor ?? "";
    if (!cursor || !items.length) break;
  }
  return out;
}

export type BillingRow = { orderSn: string; amount: number; header: string; scenario: string; remark: string; level: string; type: string; status: string };

/** Tagihan & potongan (billing). type 1 = akan dilepas, 2 = sudah dilepas. */
export async function billingTransactions(c: C, type: 1 | 2, max = 1000): Promise<BillingRow[]> {
  type T = { order_sn?: string; amount: number; cost_header?: string; scenario?: string; remark?: string; level?: string; billing_transaction_type?: string; billing_transaction_status?: string };
  const out: BillingRow[] = [];
  let cursor = "";
  for (let i = 0; i < 20 && out.length < max; i++) {
    const j = await call<{ response?: { transactions?: T[]; more?: boolean; next_cursor?: string } }>("/api/v2/payment/get_billing_transaction_info", {
      ...c,
      method: "POST",
      body: { billing_transaction_info_type: type, cursor, page_size: 100 },
    });
    for (const t of j.response?.transactions ?? [])
      out.push({
        orderSn: t.order_sn ?? "",
        amount: f(t.amount),
        header: t.cost_header ?? "",
        scenario: t.scenario ?? "",
        remark: t.remark ?? "",
        level: t.level ?? "",
        type: t.billing_transaction_type ?? "",
        status: t.billing_transaction_status ?? "",
      });
    cursor = j.response?.next_cursor ?? "";
    if (!j.response?.more || !cursor) break;
  }
  return out;
}

/** Order yang dananya dilepas dalam rentang waktu. */
export async function escrowList(c: C, from: number, to: number, max = 2000): Promise<{ orderSn: string; amount: number; releasedAt: number }[]> {
  const out: { orderSn: string; amount: number; releasedAt: number }[] = [];
  for (let page = 1; page <= 50 && out.length < max; page++) {
    const j = await call<{ response?: { escrow_list?: { order_sn: string; payout_amount: number; escrow_release_time: number }[]; more?: boolean } }>(
      "/api/v2/payment/get_escrow_list",
      { ...c, query: { release_time_from: from, release_time_to: to, page_size: 100, page_no: page } },
    );
    for (const e of j.response?.escrow_list ?? []) out.push({ orderSn: e.order_sn, amount: f(e.payout_amount), releasedAt: e.escrow_release_time });
    if (!j.response?.more) break;
  }
  return out;
}

export type Payout = { time: number; amount: number; fromAmount: number; currency: string; service: string; payee: string; orders: number };

/** Pencairan dana (rentang maks 15 hari). Shopee: endpoint ini untuk toko cross-border; toko lokal bisa kosong / ditolak. */
export async function payouts(c: C, from: number, to: number): Promise<Payout[]> {
  type P = {
    payout_info?: { payout_amount: number; from_amount: number; payout_currency: string; pay_service?: string; payee_id?: string; payout_time: number };
    escrow_list?: unknown[];
  };
  const out: Payout[] = [];
  for (let page = 1; page <= 20; page++) {
    const j = await call<{ response?: { payout_list?: P[]; more?: boolean } }>("/api/v2/payment/get_payout_detail", {
      ...c,
      query: { page_size: 100, page_no: page, payout_time_from: from, payout_time_to: to },
    });
    for (const p of j.response?.payout_list ?? []) {
      const i = p.payout_info;
      if (!i) continue;
      out.push({ time: i.payout_time, amount: f(i.payout_amount), fromAmount: f(i.from_amount), currency: i.payout_currency, service: i.pay_service ?? "", payee: i.payee_id ?? "", orders: p.escrow_list?.length ?? 0 });
    }
    if (!j.response?.more) break;
  }
  return out;
}

/** Ringkas pencairan (payout_info) — melengkapi payouts(). */
export async function payoutInfo(c: C, from: number, to: number): Promise<Payout[]> {
  type P = { payout_amount: number; from_amount: number; payout_currency: string; pay_service?: string; payee_id?: string; payout_time: number };
  const out: Payout[] = [];
  let cursor = "";
  for (let i = 0; i < 20; i++) {
    const j = await call<{ response?: { payout_list?: P[] | P; more?: boolean; next_cursor?: string } }>("/api/v2/payment/get_payout_info", {
      ...c,
      query: { payout_time_from: from, payout_time_to: to, page_size: 100, cursor },
    });
    const list = j.response?.payout_list;
    for (const p of Array.isArray(list) ? list : list ? [list] : [])
      out.push({ time: p.payout_time, amount: f(p.payout_amount), fromAmount: f(p.from_amount), currency: p.payout_currency, service: p.pay_service ?? "", payee: p.payee_id ?? "", orders: 0 });
    cursor = j.response?.next_cursor ?? "";
    if (!j.response?.more || !cursor) break;
  }
  return out;
}

export type ReportFile = { id: string; name: string; status: number; link: string; generatedAt: number };

/** Buat laporan penghasilan (report: bebas rentang; statement: mingguan Senin–Minggu / bulanan tgl 1–akhir). */
export async function generateIncomeReport(c: C, from: number, to: number): Promise<string> {
  const j = await call<{ response?: { id?: number } }>("/api/v2/payment/generate_income_report", { ...c, query: { release_time_from: from, release_time_to: to } });
  return String(j.response?.id ?? "");
}
export async function generateIncomeStatement(c: C, from: number, to: number, type: 1 | 2): Promise<string> {
  const j = await call<{ response?: { id?: number } }>("/api/v2/payment/generate_income_statement", { ...c, query: { release_time_from: from, release_time_to: to, statement_type: type } });
  return String(j.response?.id ?? "");
}
type FileRes = { response?: { id?: number; file_name?: string; status?: number; file_link?: string; generated_time?: number } };
const toFile = (j: FileRes): ReportFile => ({
  id: String(j.response?.id ?? ""),
  name: j.response?.file_name ?? "",
  status: f(j.response?.status),
  link: j.response?.file_link ?? "",
  generatedAt: f(j.response?.generated_time),
});
export async function incomeReport(c: C, id: string): Promise<ReportFile> {
  return toFile(await call<FileRes>("/api/v2/payment/get_income_report", { ...c, query: { income_report_id: id } }));
}
export async function incomeStatement(c: C, id: string): Promise<ReportFile> {
  return toFile(await call<FileRes>("/api/v2/payment/get_income_statement", { ...c, query: { income_statement_id: id } }));
}
