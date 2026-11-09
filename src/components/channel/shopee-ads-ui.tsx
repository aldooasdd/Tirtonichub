"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adCreate, adEdit, adKeywords, gmsCreate, gmsEdit, suggestBudget, suggestKeywords, suggestRoas } from "@/server/actions/shopee-ads";
import type { Keyword } from "@/server/marketplace/shopee-ads";

/** Tanggal hari ini (WIB) "YYYY-MM-DD". */
const todayWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
const field = "h-9 rounded-md border bg-background px-2 text-14";
const btn = "h-9 rounded-md border px-3 text-14 font-medium disabled:opacity-40";
const primary = "h-9 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground disabled:opacity-40";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = <T,>(fn: () => Promise<{ ok: boolean; message?: string; data?: T }>, confirmText?: string, after?: (d?: T) => void) => {
    if (confirmText && !confirm(confirmText)) return;
    start(async () => {
      const r = await fn().catch(() => ({ ok: false, message: "Gagal. Muat ulang halaman.", data: undefined }));
      if (r.message) setMsg({ ok: r.ok, text: r.message });
      if (r.ok) {
        after?.(r.data);
        router.refresh();
      }
    });
  };
  const note = msg && <p className={`text-12 ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>;
  return { pending, run, note, setMsg };
}

/** Aksi 1 iklan produk: jeda/lanjut/stop/hapus, budget, durasi, target ROAS. */
export function AdActions({ id, status, budget, roasTarget, bidding }: { id: string; status: string; budget: number; roasTarget: number; bidding: string }) {
  const { pending, run, note } = useRun();
  const [b, setB] = useState(String(budget || ""));
  const [r, setR] = useState(String(roasTarget || ""));
  const [end, setEnd] = useState("");
  const live = status === "ongoing";
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        {live ? (
          <button className={btn} disabled={pending} onClick={() => run(() => adEdit(id, "pause"), "Jeda iklan ini?")}>Jeda</button>
        ) : status === "paused" ? (
          <button className={btn} disabled={pending} onClick={() => run(() => adEdit(id, "resume"), "Lanjutkan iklan ini? Biaya iklan akan berjalan lagi.")}>Lanjutkan</button>
        ) : status === "scheduled" ? (
          <button className={btn} disabled={pending} onClick={() => run(() => adEdit(id, "start"), "Mulai iklan sekarang?")}>Mulai</button>
        ) : null}
        {status !== "ended" && status !== "closed" && status !== "deleted" && (
          <button className={`${btn} text-destructive`} disabled={pending} onClick={() => run(() => adEdit(id, "stop"), "Hentikan iklan ini? Tidak bisa dilanjutkan lagi.")}>Hentikan</button>
        )}
        <button className={`${btn} text-destructive`} disabled={pending} onClick={() => run(() => adEdit(id, "delete"), "Hapus iklan ini dari Shopee?")}>Hapus</button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Budget (Rp, 0 = tanpa batas)
          <input inputMode="numeric" value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ""))} className={`${field} w-40`} />
        </label>
        <button className={btn} disabled={pending || Number(b) === budget} onClick={() => run(() => adEdit(id, "change_budget", { budget: Number(b) }), `Ubah budget jadi ${rupiah(Number(b))}?`)}>Simpan budget</button>
        {bidding === "auto" && (
          <>
            <label className="flex flex-col gap-1 text-12 text-muted-foreground">
              Target ROAS
              <input inputMode="decimal" value={r} onChange={(e) => setR(e.target.value.replace(/[^\d.]/g, ""))} className={`${field} w-28`} />
            </label>
            <button className={btn} disabled={pending || Number(r) === roasTarget} onClick={() => run(() => adEdit(id, "change_roas_target", { roasTarget: Number(r) }), `Ubah target ROAS jadi ${r}?`)}>Simpan ROAS</button>
          </>
        )}
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Tanggal selesai (kosong = tanpa batas)
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={field} />
        </label>
        <button
          className={btn}
          disabled={pending}
          onClick={() => run(() => adEdit(id, "change_duration", { start: todayWib(), end: end || undefined }), "Ubah durasi iklan?")}
        >
          Simpan durasi
        </button>
      </div>
      {note}
    </div>
  );
}

/** Keyword iklan manual: tambah, hapus, ubah bid / tipe cocok. */
export function KeywordEditor({ id, itemId, keywords }: { id: string; itemId: string; keywords: Keyword[] }) {
  const { pending, run, note } = useRun();
  const [bids, setBids] = useState(() => Object.fromEntries(keywords.map((k) => [k.keyword, String(k.bid)])));
  const [kw, setKw] = useState("");
  const [bid, setBid] = useState("");
  const [match, setMatch] = useState<"exact" | "broad">("broad");
  const [sug, setSug] = useState<{ keyword: string; quality: number; volume: number; bid: number }[] | null>(null);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-14">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-3">Keyword</th>
              <th className="p-3">Cocok</th>
              <th className="p-3">Status</th>
              <th className="p-3">Bid/klik (Rp)</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {keywords.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">Belum ada keyword.</td>
              </tr>
            )}
            {keywords.map((k) => (
              <tr key={k.keyword} className="border-b last:border-b-0">
                <td className="p-3">{k.keyword}</td>
                <td className="p-3">
                  <select
                    defaultValue={k.match}
                    disabled={pending}
                    onChange={(e) => run(() => adKeywords(id, [{ action: "change_match_type", keyword: k.keyword, match: e.target.value as "exact" | "broad" }]))}
                    className={field}
                  >
                    <option value="broad">Luas</option>
                    <option value="exact">Persis</option>
                  </select>
                </td>
                <td className="p-3">{k.status}</td>
                <td className="p-3">
                  <input inputMode="numeric" value={bids[k.keyword] ?? ""} onChange={(e) => setBids({ ...bids, [k.keyword]: e.target.value.replace(/\D/g, "") })} className={`${field} w-28`} />
                </td>
                <td className="p-3 whitespace-nowrap">
                  <button
                    className={btn}
                    disabled={pending || Number(bids[k.keyword]) === k.bid}
                    onClick={() => run(() => adKeywords(id, [{ action: "change_bid_price", keyword: k.keyword, bid: Number(bids[k.keyword]) }]), `Ubah bid "${k.keyword}"?`)}
                  >
                    Simpan
                  </button>{" "}
                  {k.status === "deleted" ? (
                    <button className={btn} disabled={pending} onClick={() => run(() => adKeywords(id, [{ action: "restore", keyword: k.keyword }]))}>Pulihkan</button>
                  ) : (
                    <button className={`${btn} text-destructive`} disabled={pending} onClick={() => run(() => adKeywords(id, [{ action: "delete", keyword: k.keyword }]), `Hapus keyword "${k.keyword}"?`)}>Hapus</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Keyword baru
          <input value={kw} onChange={(e) => setKw(e.target.value)} className={`${field} w-56`} />
        </label>
        <select value={match} onChange={(e) => setMatch(e.target.value as "exact" | "broad")} className={field}>
          <option value="broad">Luas</option>
          <option value="exact">Persis</option>
        </select>
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Bid/klik (Rp)
          <input inputMode="numeric" value={bid} onChange={(e) => setBid(e.target.value.replace(/\D/g, ""))} className={`${field} w-28`} />
        </label>
        <button
          className={primary}
          disabled={pending || !kw.trim() || !Number(bid)}
          onClick={() => run(() => adKeywords(id, [{ action: "add", keyword: kw.trim(), match, bid: Number(bid) }]), undefined, () => setKw(""))}
        >
          Tambah
        </button>
        <button className={btn} disabled={pending} onClick={() => run(() => suggestKeywords(itemId, kw.trim()), undefined, (d) => setSug(d ?? []))}>
          Saran keyword
        </button>
      </div>
      {sug && <Suggestions rows={sug} onPick={(s) => { setKw(s.keyword); setBid(String(Math.round(s.bid))); }} />}
      {note}
    </div>
  );
}

function Suggestions({ rows, onPick }: { rows: { keyword: string; quality: number; volume: number; bid: number }[]; onPick: (r: { keyword: string; bid: number }) => void }) {
  if (!rows.length) return <p className="text-12 text-muted-foreground">Tidak ada saran.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-14">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="p-3">Saran keyword</th>
            <th className="p-3 text-right">Pencarian 30 hari</th>
            <th className="p-3 text-right">Kualitas</th>
            <th className="p-3 text-right">Saran bid</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.keyword} className="border-b last:border-b-0">
              <td className="p-3">{s.keyword}</td>
              <td className="p-3 text-right tabular-nums">{new Intl.NumberFormat("id-ID").format(s.volume)}</td>
              <td className="p-3 text-right tabular-nums">{s.quality}</td>
              <td className="p-3 text-right tabular-nums">{rupiah(s.bid)}</td>
              <td className="p-3">
                <button className={btn} onClick={() => onPick(s)}>Pakai</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Form buat iklan produk baru. */
export function AdCreate({ items, defaultItem }: { items: { id: string; name: string }[]; defaultItem?: string }) {
  const { pending, run, note } = useRun();
  const [today] = useState(todayWib);
  const [itemId, setItemId] = useState(defaultItem ?? "");
  const [q, setQ] = useState("");
  const [budget, setBudget] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState("");
  const [bidding, setBidding] = useState<"auto" | "manual">("auto");
  const [roas, setRoas] = useState("");
  const [kws, setKws] = useState<{ keyword: string; match: "exact" | "broad"; bid: number }[]>([]);
  const [hint, setHint] = useState("");
  const [sug, setSug] = useState<{ keyword: string; quality: number; volume: number; bid: number }[] | null>(null);
  const shown = items.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase())).slice(0, 200);

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Cari produk
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nama produk" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Produk
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={field}>
            <option value="">Pilih produk</option>
            {shown.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Cara bid
          <select value={bidding} onChange={(e) => setBidding(e.target.value as "auto" | "manual")} className={field}>
            <option value="auto">Otomatis (Shopee atur bid)</option>
            <option value="manual">Manual (pilih keyword & bid)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Budget total (Rp, 0 = tanpa batas)
          <input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Mulai
          <input type="date" value={start} min={today} onChange={(e) => setStart(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Selesai (kosong = tanpa batas)
          <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={field} />
        </label>
        {bidding === "auto" && (
          <label className="flex flex-col gap-1 text-12 text-muted-foreground">
            Target ROAS (kosong/0 = tidak pakai)
            <input inputMode="decimal" value={roas} onChange={(e) => setRoas(e.target.value.replace(/[^\d.]/g, ""))} className={field} />
          </label>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className={btn}
          disabled={pending || !itemId}
          onClick={() =>
            run(
              () => suggestBudget({ itemId, bidding, placement: "all", roasTarget: Number(roas) || undefined }),
              undefined,
              (d) => d && setHint(`Saran budget: ${rupiah(d.recommended)} (min ${rupiah(d.min)}, maks ${rupiah(d.max)})`),
            )
          }
        >
          Saran budget
        </button>
        {bidding === "auto" && (
          <button
            className={btn}
            disabled={pending || !itemId}
            onClick={() => run(() => suggestRoas(itemId), undefined, (d) => d && setHint(`Saran target ROAS: ${d.low} (lebih banyak tampil) · ${d.mid} · ${d.high} (lebih hemat)`))}
          >
            Saran target ROAS
          </button>
        )}
        {bidding === "manual" && (
          <button className={btn} disabled={pending || !itemId} onClick={() => run(() => suggestKeywords(itemId), undefined, (d) => setSug(d ?? []))}>
            Saran keyword
          </button>
        )}
      </div>
      {hint && <p className="text-14 text-muted-foreground">{hint}</p>}
      {bidding === "manual" && (
        <div className="space-y-2">
          <p className="text-14 font-medium">Keyword ({kws.length})</p>
          {kws.map((k, i) => (
            <div key={k.keyword} className="flex flex-wrap items-center gap-2 text-14">
              <span className="min-w-40">{k.keyword}</span>
              <select value={k.match} onChange={(e) => setKws(kws.map((x, j) => (j === i ? { ...x, match: e.target.value as "exact" | "broad" } : x)))} className={field}>
                <option value="broad">Luas</option>
                <option value="exact">Persis</option>
              </select>
              <input inputMode="numeric" value={k.bid || ""} onChange={(e) => setKws(kws.map((x, j) => (j === i ? { ...x, bid: Number(e.target.value.replace(/\D/g, "")) } : x)))} className={`${field} w-28`} />
              <button className={`${btn} text-destructive`} onClick={() => setKws(kws.filter((_, j) => j !== i))}>Hapus</button>
            </div>
          ))}
          {sug && <Suggestions rows={sug.filter((s) => !kws.some((k) => k.keyword === s.keyword))} onPick={(s) => setKws([...kws, { keyword: s.keyword, match: "broad", bid: Math.round(s.bid) }])} />}
        </div>
      )}
      <button
        className={primary}
        disabled={pending || !itemId || budget === "" || (bidding === "manual" && !kws.length)}
        onClick={() =>
          run(
            () => adCreate({ itemId, budget: Number(budget), start, end: end || undefined, bidding, roasTarget: bidding === "auto" && roas ? Number(roas) : undefined, keywords: kws }),
            `Buat iklan dengan budget ${Number(budget) ? rupiah(Number(budget)) : "tanpa batas"}? Biaya iklan akan dipotong dari saldo iklan Shopee.`,
          )
        }
      >
        Buat iklan
      </button>
      {note}
    </div>
  );
}

/** GMV Max: buat atau ubah. */
export function GmsActions({ campaignId, eligible, reason }: { campaignId: string | null; eligible: boolean; reason: string }) {
  const { pending, run, note } = useRun();
  const [today] = useState(todayWib);
  const [budget, setBudget] = useState("");
  const [roas, setRoas] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState("");
  const dates = (
    <>
      <label className="flex flex-col gap-1 text-12 text-muted-foreground">
        Mulai
        <input type="date" value={start} min={today} onChange={(e) => setStart(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-12 text-muted-foreground">
        Selesai (kosong = tanpa batas)
        <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={field} />
      </label>
    </>
  );
  const budgetIn = (
    <label className="flex flex-col gap-1 text-12 text-muted-foreground">
      Budget harian (Rp)
      <input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} className={`${field} w-36`} />
    </label>
  );
  const roasIn = (
    <label className="flex flex-col gap-1 text-12 text-muted-foreground">
      Target ROAS (kosong/0 = otomatis)
      <input inputMode="decimal" value={roas} onChange={(e) => setRoas(e.target.value.replace(/[^\d.]/g, ""))} className={`${field} w-28`} />
    </label>
  );
  if (!campaignId)
    return (
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <p className="text-14 font-medium">Buat iklan GMV Max (seluruh toko)</p>
        {!eligible && <p className="text-14 text-amber-700">Belum bisa buat: {reason || "tidak memenuhi syarat"}.</p>}
        <div className="flex flex-wrap items-end gap-2">
          {budgetIn}
          {roasIn}
          {dates}
          <button
            className={primary}
            disabled={pending || !eligible || !Number(budget)}
            onClick={() =>
              run(
                () => gmsCreate({ start, end: end || undefined, dailyBudget: Number(budget), roasTarget: roas ? Number(roas) : undefined }),
                `Buat GMV Max dengan budget harian ${rupiah(Number(budget))}?`,
              )
            }
          >
            Buat GMV Max
          </button>
        </div>
        {note}
      </div>
    );
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        <button className={btn} disabled={pending} onClick={() => run(() => gmsEdit(campaignId, "pause"), "Jeda GMV Max?")}>Jeda</button>
        <button className={btn} disabled={pending} onClick={() => run(() => gmsEdit(campaignId, "resume"), "Lanjutkan GMV Max?")}>Lanjutkan</button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {budgetIn}
        <button className={btn} disabled={pending || !Number(budget)} onClick={() => run(() => gmsEdit(campaignId, "change_budget", { dailyBudget: Number(budget) }), `Ubah budget harian jadi ${rupiah(Number(budget))}?`)}>Simpan budget</button>
        {roasIn}
        <button className={btn} disabled={pending || roas === ""} onClick={() => run(() => gmsEdit(campaignId, "change_roas_target", { roasTarget: Number(roas) }), `Ubah target ROAS jadi ${roas || "otomatis"}?`)}>Simpan ROAS</button>
        {dates}
        <button className={btn} disabled={pending} onClick={() => run(() => gmsEdit(campaignId, "change_duration", { start, end: end || undefined }), "Ubah durasi GMV Max?")}>Simpan durasi</button>
      </div>
      {note}
    </div>
  );
}
