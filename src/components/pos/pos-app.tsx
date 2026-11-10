"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, LogOut, Minus, Plus, ScanBarcode, Search, Trash2, UserRound, X } from "lucide-react";
import { posLogout, posLookup, posSave, posSearch, type PosProduct, type PosSaleResult } from "@/server/actions/pos";

type User = { id: string; name: string; role: string };
type Line = PosProduct & { qty: number };
type Flash = { ok: boolean; title: string; sub: string } | null;

const rp = (n: number) => "Rp " + n.toLocaleString("id-ID");
const initials = (s: string) => s.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const METHODS = ["Tunai", "Debit BCA", "Debit BRI", "Debit Mandiri", "Transfer"] as const;

function beep(ok: boolean) {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < (ok ? 1 : 2); i++) {
      const o = ctx.createOscillator();
      o.frequency.value = ok ? 1200 : 300;
      o.connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.12);
    }
  } catch {}
}

export function PosApp({ branch, users }: { branch: { id: string; name: string }; users: User[] }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stage, setStage] = useState<"sale" | "pay" | "done">("sale");
  const [cart, setCart] = useState<Line[]>([]);
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState<(typeof METHODS)[number]>("Tunai");
  const [paid, setPaid] = useState(0);
  const [result, setResult] = useState<(PosSaleResult & { lines: Line[]; sub: number; method: string; paid: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const subtotal = cart.reduce((n, l) => n + l.price * l.qty, 0);
  const total = Math.max(0, subtotal - discount);

  function reset() {
    setCart([]);
    setCustomer("");
    setPhone("");
    setDiscount(0);
    setMethod("Tunai");
    setPaid(0);
    setResult(null);
    setError(null);
    setStage("sale");
  }

  if (!user) return <PickUser branch={branch} users={users} onPick={setUser} onLogout={() => start(async () => { await posLogout(); router.refresh(); })} />;

  function add(p: PosProduct) {
    setCart((c) => {
      const i = c.findIndex((l) => l.sku.toLowerCase() === p.sku.toLowerCase());
      if (i < 0) return [...c, { ...p, qty: 1 }];
      const n = [...c];
      n[i] = { ...n[i], qty: n[i].qty + 1 };
      return n;
    });
  }
  const setQty = (sku: string, qty: number) => setCart((c) => (qty <= 0 ? c.filter((l) => l.sku !== sku) : c.map((l) => (l.sku === sku ? { ...l, qty } : l))));

  function pay() {
    setError(null);
    start(async () => {
      const r = await posSave({
        cashierId: user!.id,
        salesId: user!.id, // sales = pengguna POS yang login
        customer,
        phone,
        items: cart.map((l) => ({ sku: l.sku, name: l.name, qty: l.qty, price: l.price })),
        discount,
        method,
        paid: method === "Tunai" ? paid : total,
      });
      if (!r.ok) return setError(r.message ?? "Gagal menyimpan.");
      setResult({ ...r, lines: cart, sub: subtotal, method, paid: method === "Tunai" ? paid : total });
      setStage("done");
    });
  }

  const header = (
    <div className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-3">
        <span className="text-18 font-bold">Tirtonichub.</span>
        <span className="rounded-sm bg-muted px-2.5 py-1 text-14 font-medium">Kasir · {branch.name}</span>
      </div>
      <div className="flex items-center gap-4 text-14">
        <span className="font-medium">{user.name}</span>
        <button onClick={() => { reset(); setUser(null); }} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
          <UserRound className="h-4 w-4" /> Ganti pengguna
        </button>
      </div>
    </div>
  );

  if (stage === "done" && result)
    return (
      <div className="flex h-screen flex-col bg-muted">
        {header}
        <Struk branch={branch.name} cashier={user.name} sales={user.name} r={result} discount={discount} />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 print:hidden">
          <CircleCheck className="h-16 w-16 text-success" />
          <div className="text-center">
            <p className="text-[40px] font-bold">Tersimpan</p>
            <p className="text-16 text-muted-foreground">Nota {result.notaNo} · menunggu ACC Kepala Cabang</p>
          </div>
          {result.change! > 0 && (
            <div className="rounded-lg bg-success/10 px-8 py-4 text-center">
              <p className="text-14 text-success">Kembalian</p>
              <p className="text-[32px] font-bold text-success">{rp(result.change!)}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => window.print()} className="h-14 rounded-md border bg-background px-8 text-16 font-semibold">Cetak struk</button>
            <button autoFocus onClick={reset} className="h-14 rounded-md bg-primary px-8 text-16 font-semibold text-primary-foreground">Transaksi baru</button>
          </div>
        </div>
      </div>
    );

  if (stage === "pay")
    return (
      <div className="flex h-screen flex-col bg-background">
        {header}
        <Pay
          total={total}
          method={method}
          setMethod={setMethod}
          paid={paid}
          setPaid={setPaid}
          pending={pending}
          error={error}
          onBack={() => { setError(null); setStage("sale"); }}
          onPay={pay}
        />
      </div>
    );

  return (
    <div className="flex h-screen flex-col bg-background">
      {header}
      <div className="flex min-h-0 flex-1">
        <ScanPanel onAdd={add} />
        <div className="flex w-[420px] shrink-0 flex-col border-l">
          <div className="space-y-2 p-5 pb-3">
            <div className="flex items-baseline justify-between">
              <p className="text-18 font-bold">Pesanan baru</p>
              {cart.length > 0 && <button onClick={() => setCart([])} className="text-14 text-destructive">Kosongkan</button>}
            </div>
            <p className="text-14 text-muted-foreground">Sales: <span className="font-semibold text-foreground">{user.name}</span> · masuk bonus</p>
            <div className="flex gap-2">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="No. WA pelanggan (wajib)" className="h-11 min-w-0 flex-1 rounded-md bg-muted px-3 text-14 outline-none" />
              <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nama (opsional)" className="h-11 w-36 rounded-md bg-muted px-3 text-14 outline-none" />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5">
            {cart.length === 0 && <p className="py-16 text-center text-14 text-muted-foreground">Belum ada barang. Scan barcode untuk mulai.</p>}
            {cart.map((l) => (
              <div key={l.sku} className="flex items-center gap-3 border-b py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-16">{l.name}</p>
                  <p className="text-12 text-muted-foreground">{l.sku} · {rp(l.price)}</p>
                </div>
                <div className="flex items-center rounded-md border">
                  <button onClick={() => setQty(l.sku, l.qty - 1)} className="grid h-9 w-9 place-items-center">{l.qty === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}</button>
                  <span className="w-6 text-center text-16 font-semibold">{l.qty}</span>
                  <button onClick={() => setQty(l.sku, l.qty + 1)} className="grid h-9 w-9 place-items-center"><Plus className="h-4 w-4" /></button>
                </div>
                <p className="w-24 text-right text-16 font-semibold">{rp(l.price * l.qty)}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t p-5">
            <div className="flex justify-between text-14"><span className="text-muted-foreground">Subtotal</span><span>{rp(subtotal)}</span></div>
            <div className="flex items-center justify-between text-14">
              <span className="text-muted-foreground">Diskon (Rp)</span>
              <input value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value.replace(/\D/g, "")) || 0)} inputMode="numeric" placeholder="0" className="h-8 w-32 rounded-sm bg-muted px-2 text-right outline-none" />
            </div>
            <div className="flex items-center justify-between py-1"><span className="text-18 font-semibold">Total</span><span className="text-24 font-bold">{rp(total)}</span></div>
            <button
              disabled={!cart.length || !phone.trim()}
              onClick={() => { setPaid(0); setStage("pay"); }}
              className="h-14 w-full rounded-md bg-primary text-18 font-semibold text-primary-foreground disabled:opacity-40"
            >
              {!cart.length ? "Bayar"  : !phone.trim() ? "Isi no. WA dulu" : "Bayar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PickUser({ branch, users, onPick, onLogout }: { branch: { name: string }; users: User[]; onPick: (u: User) => void; onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-muted p-12">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-24 font-bold">Pilih pengguna</h1>
          <p className="text-16 text-muted-foreground">{branch.name}</p>
        </div>
        <button onClick={onLogout} className="flex items-center gap-1.5 text-14 text-muted-foreground"><LogOut className="h-4 w-4" /> Keluar mesin</button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {users.map((u) => (
          <button key={u.id} onClick={() => onPick(u)} className="flex flex-col items-center gap-1 rounded-lg border bg-background p-5 hover:border-foreground">
            <span className="mb-1 grid h-16 w-16 place-items-center rounded-full bg-primary text-24 font-semibold text-primary-foreground">{initials(u.name)}</span>
            <span className="text-16 font-semibold">{u.name}</span>
            <span className="text-12 text-muted-foreground">{u.role}</span>
          </button>
        ))}
        {users.length === 0 && <p className="text-muted-foreground">Belum ada karyawan aktif di cabang ini.</p>}
      </div>
    </div>
  );
}

function ScanPanel({ onAdd }: { onAdd: (p: PosProduct) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [flash, setFlash] = useState<Flash>(null);
  const [manual, setManual] = useState(false);
  const [pending, start] = useTransition();

  // Scanner = keyboard: input selalu fokus kecuali sedang cari manual / isi field lain.
  useEffect(() => {
    const t = setInterval(() => {
      const a = document.activeElement;
      if (!manual && (!a || a === document.body)) ref.current?.focus();
    }, 500);
    return () => clearInterval(t);
  }, [manual]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setCode("");
    start(async () => {
      const p = await posLookup(c);
      if (p) {
        onAdd(p);
        beep(true);
        setFlash({ ok: true, title: `Ditambahkan: ${p.name}`, sub: `${p.sku} · ${rp(p.price)}` });
      } else {
        beep(false);
        setFlash({ ok: false, title: `SKU "${c}" tidak ditemukan di Produk Master`, sub: "Cek label, atau cari manual." });
      }
      ref.current?.focus();
    });
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 bg-muted p-6">
      <form onSubmit={submit} className="flex h-[52px] items-center gap-3 rounded-md border bg-background px-4">
        <ScanBarcode className="h-5 w-5 text-muted-foreground" />
        <input ref={ref} autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Scan barcode barang, atau ketik SKU lalu Enter" className="h-full flex-1 bg-transparent text-16 outline-none" />
        <span className="rounded-sm bg-success/10 px-2 py-1 text-12 font-medium text-success">{pending ? "Mencari…" : "Scanner siap"}</span>
      </form>
      {manual ? (
        <ManualSearch onPick={(p) => { onAdd(p); setFlash({ ok: true, title: `Ditambahkan: ${p.name}`, sub: `${p.sku} · ${rp(p.price)}` }); }} onClose={() => { setManual(false); ref.current?.focus(); }} />
      ) : (
        <button type="button" onClick={() => ref.current?.focus()} className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-background">
          <ScanBarcode className="h-24 w-24" strokeWidth={1.5} />
          <p className="text-[28px] font-bold">Scan barcode barang</p>
          <p className="text-center text-14 text-muted-foreground">Arahkan scanner ke label SKU. Barang langsung masuk keranjang.<br />Scan barang yang sama lagi = qty +1.</p>
        </button>
      )}
      {flash && (
        <div className={`flex items-center gap-3 rounded-lg px-5 py-4 ${flash.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
          {flash.ok ? <CircleCheck className="h-7 w-7 shrink-0" /> : <CircleAlert className="h-7 w-7 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-16 font-semibold">{flash.title}</p>
            <p className="text-14">{flash.sub}</p>
          </div>
          {!flash.ok && !manual && (
            <button onClick={() => setManual(true)} className="flex items-center gap-1.5 rounded-md bg-background px-3 py-2 text-14 font-semibold text-foreground"><Search className="h-4 w-4" /> Cari manual</button>
          )}
        </div>
      )}
      {!manual && !flash && (
        <button onClick={() => setManual(true)} className="flex items-center gap-1.5 self-start text-14 text-muted-foreground"><Search className="h-4 w-4" /> Cari manual</button>
      )}
    </div>
  );
}

function ManualSearch({ onPick, onClose }: { onPick: (p: PosProduct) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PosProduct[]>([]);
  const [pending, start] = useTransition();
  function search(e: React.FormEvent) {
    e.preventDefault();
    start(async () => setRows(await posSearch(q)));
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-xl bg-background p-4">
      <form onSubmit={search} className="flex gap-2">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nama / SKU produk" className="h-11 flex-1 rounded-md border px-3 text-16 outline-none" />
        <button className="h-11 rounded-md bg-primary px-5 text-14 font-semibold text-primary-foreground">{pending ? "…" : "Cari"}</button>
        <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-md border"><X className="h-4 w-4" /></button>
      </form>
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto lg:grid-cols-3">
        {rows.map((p) => (
          <button key={p.sku} onClick={() => onPick(p)} className="rounded-lg border p-3 text-left hover:border-foreground">
            <p className="line-clamp-2 text-14 font-medium">{p.name}</p>
            <p className="text-12 text-muted-foreground">{p.sku}</p>
            <p className="mt-1 text-14 font-semibold">{rp(p.price)}</p>
          </button>
        ))}
        {!pending && q && rows.length === 0 && <p className="text-14 text-muted-foreground">Tidak ada hasil.</p>}
      </div>
    </div>
  );
}

function Pay(p: {
  total: number;
  method: (typeof METHODS)[number];
  setMethod: (m: (typeof METHODS)[number]) => void;
  paid: number;
  setPaid: (n: number) => void;
  pending: boolean;
  error: string | null;
  onBack: () => void;
  onPay: () => void;
}) {
  const cash = p.method === "Tunai";
  const change = p.paid - p.total;
  const quick = [p.total, Math.ceil(p.total / 50_000) * 50_000, Math.ceil(p.total / 100_000) * 100_000, Math.ceil(p.total / 100_000) * 100_000 + 100_000];
  const key = (k: string) => p.setPaid(k === "⌫" ? Math.floor(p.paid / 10) : Number(`${p.paid || ""}${k}`) || 0);
  const ready = !p.pending && (!cash || p.paid >= p.total);
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-10 py-8">
        <button onClick={p.onBack} className="self-start text-14 text-muted-foreground">← Kembali ke keranjang</button>
        <div>
          <p className="text-14 text-muted-foreground">Total tagihan</p>
          <p className="text-[44px] font-bold tracking-tight">{rp(p.total)}</p>
        </div>
        <div className="space-y-3">
          <p className="text-14 font-semibold">Metode bayar</p>
          <div className="grid grid-cols-3 gap-3">
            {METHODS.map((m) => (
              <button key={m} onClick={() => p.setMethod(m)} className={`rounded-lg border p-4 text-left text-16 font-semibold ${p.method === m ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{m}</button>
            ))}
            <div className="rounded-lg border p-4 opacity-45">
              <p className="text-16 font-semibold">QRIS</p>
              <p className="text-12 text-muted-foreground">Menunggu ACC Midtrans</p>
            </div>
          </div>
        </div>
        {cash ? (
          <>
            <div className="space-y-3">
              <p className="text-14 font-semibold">Uang diterima</p>
              <div className="flex h-[72px] items-center rounded-lg border-2 border-foreground px-5 text-[32px] font-bold">{rp(p.paid)}</div>
              <div className="grid grid-cols-4 gap-2">
                {[...new Set(quick)].map((n, i) => (
                  <button key={n} onClick={() => p.setPaid(n)} className="rounded-md bg-muted py-3 text-14 font-semibold">{i === 0 ? "Uang pas" : n.toLocaleString("id-ID")}</button>
                ))}
              </div>
            </div>
            {p.paid >= p.total && (
              <div className="flex items-center justify-between rounded-lg bg-success/10 px-5 py-4 text-success">
                <span className="text-18 font-semibold">Kembalian</span>
                <span className="text-24 font-bold">{rp(change)}</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-14 text-muted-foreground">Pastikan pembayaran {p.method} sebesar {rp(p.total)} sudah berhasil sebelum menyelesaikan.</p>
        )}
        {p.error && <p className="text-14 text-destructive">{p.error}</p>}
      </div>
      <div className="flex w-[420px] shrink-0 flex-col justify-end gap-4 border-l bg-muted p-6">
        {cash && (
          <div className="grid grid-cols-3 gap-2.5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "⌫"].map((k) => (
              <button key={k} onClick={() => key(k)} className="h-[72px] rounded-md border bg-background text-24 font-semibold">{k}</button>
            ))}
          </div>
        )}
        <button disabled={!ready} onClick={p.onPay} className="h-16 rounded-md bg-primary text-18 font-semibold text-primary-foreground disabled:opacity-40">
          {p.pending ? "Menyimpan…" : "Selesaikan"}
        </button>
      </div>
    </div>
  );
}

function Struk({ branch, cashier, sales, r, discount }: { branch: string; cashier: string; sales: string; r: PosSaleResult & { lines: Line[]; sub: number; method: string; paid: number }; discount: number }) {
  const t = new Date(r.soldAt!).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "short", timeStyle: "short" });
  const row = (a: string, b: string, bold = false) => (
    <div className={`flex justify-between ${bold ? "text-[14px] font-bold" : ""}`}><span>{a}</span><span>{b}</span></div>
  );
  return (
    <div id="struk" className="hidden w-[58mm] bg-white p-2 text-[11px] leading-snug text-black print:block">
      <style>{`@media print { @page { size: 58mm auto; margin: 0 } body * { visibility: hidden } #struk, #struk * { visibility: visible } #struk { position: absolute; left: 0; top: 0 } }`}</style>
      <p className="text-center text-[16px] font-bold">TIRTONIC</p>
      <p className="text-center">{branch}</p>
      <p className="my-1 border-t border-dashed border-black" />
      <p>{r.notaNo} · {t}</p>
      <p>Kasir: {cashier} · Sales: {sales}</p>
      <p className="my-1 border-t border-dashed border-black" />
      {r.lines.map((l) => (
        <div key={l.sku}>
          <p>{l.name}</p>
          {row(`  ${l.qty} x ${l.price.toLocaleString("id-ID")}`, (l.qty * l.price).toLocaleString("id-ID"))}
        </div>
      ))}
      <p className="my-1 border-t border-dashed border-black" />
      {row("Subtotal", r.sub.toLocaleString("id-ID"))}
      {discount > 0 && row("Diskon", `-${discount.toLocaleString("id-ID")}`)}
      {row("TOTAL", r.total!.toLocaleString("id-ID"), true)}
      {row(r.method, r.paid.toLocaleString("id-ID"))}
      {r.change! > 0 && row("Kembali", r.change!.toLocaleString("id-ID"))}
      <p className="my-1 border-t border-dashed border-black" />
      <p className="text-center">Terima kasih!</p>
    </div>
  );
}
