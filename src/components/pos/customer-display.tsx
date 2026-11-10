"use client";

import { useEffect, useState } from "react";
import { CircleCheck } from "lucide-react";

export type DisplayMsg =
  | { type: "cart"; lines: { name: string; qty: number; total: number }[]; subtotal: number; discount: number; total: number; sales: string }
  | { type: "done"; total: number; change: number }
  | { type: "idle" };

export const DISPLAY_CHANNEL = "tirtonic-pos-layar";
type Slide = { id: string; url: string; isVideo: boolean };
const rp = (n: number) => "Rp " + n.toLocaleString("id-ID");

/** Layar pembeli: campaign bergantian saat kosong, keranjang saat transaksi, terima kasih saat selesai. */
export function CustomerDisplay({ branch, slides }: { branch: string; slides: Slide[] }) {
  const [msg, setMsg] = useState<DisplayMsg>({ type: "idle" });
  const [i, setI] = useState(0);

  // Kasir (/pos) mengirim isi keranjang lewat BroadcastChannel di perangkat yang sama.
  useEffect(() => {
    const ch = new BroadcastChannel(DISPLAY_CHANNEL);
    let t: ReturnType<typeof setTimeout> | undefined;
    ch.onmessage = (e: MessageEvent<DisplayMsg>) => {
      clearTimeout(t);
      setMsg(e.data);
      if (e.data.type === "done") t = setTimeout(() => setMsg({ type: "idle" }), 10_000);
    };
    return () => { clearTimeout(t); ch.close(); };
  }, []);

  // Gambar 8 detik; video sampai selesai (onEnded).
  const cur = slides.length ? slides[i % slides.length] : null;
  useEffect(() => {
    if (msg.type !== "idle" || !cur || cur.isVideo || slides.length < 2) return;
    const t = setTimeout(() => setI((n) => n + 1), 8_000);
    return () => clearTimeout(t);
  }, [i, cur, msg.type, slides.length]);

  if (msg.type === "cart")
    return (
      <div className="flex h-screen bg-white text-[#1a1a1a]">
        <div className="flex min-w-0 flex-1 flex-col p-12">
          <div className="flex items-baseline justify-between pb-4">
            <p className="text-[28px] font-bold">Belanjaan Anda</p>
            <p className="text-16 text-[#8a8a8e]">{msg.lines.reduce((n, l) => n + l.qty, 0)} barang</p>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {msg.lines.slice(-8).map((l, k) => (
              <div key={k} className="flex items-center gap-4 border-b border-[#e8e8e8] py-4 text-18">
                <span className="w-10 font-semibold text-[#8a8a8e]">{l.qty}×</span>
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                <span className="font-semibold">{rp(l.total)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex w-[460px] flex-col justify-between bg-[#1a1a1a] p-12 text-white">
          <div>
            <p className="text-[22px] font-bold">Tirtonic</p>
            <p className="text-14 text-white/60">{branch} · Dilayani: {msg.sales}</p>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-16"><span className="text-white/60">Subtotal</span><span>{rp(msg.subtotal)}</span></div>
            {msg.discount > 0 && <div className="flex justify-between text-16"><span className="text-white/60">Hemat</span><span className="text-[#4ade80]">− {rp(msg.discount)}</span></div>}
            <p className="text-16 text-white/60">Total bayar</p>
            <p className="text-[52px] font-bold tracking-tight">{rp(msg.total)}</p>
          </div>
        </div>
      </div>
    );

  if (msg.type === "done")
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-5 bg-white text-[#1a1a1a]">
        <CircleCheck className="h-28 w-28 text-[#22c55e]" />
        <p className="text-[48px] font-bold">Terima kasih!</p>
        <p className="text-20 text-[#8a8a8e]">Pembayaran {rp(msg.total)} berhasil</p>
        {msg.change > 0 && (
          <div className="rounded-lg bg-[#f5f5f5] px-8 py-4 text-center">
            <p className="text-14 text-[#8a8a8e]">Kembalian</p>
            <p className="text-[28px] font-bold">{rp(msg.change)}</p>
          </div>
        )}
      </div>
    );

  if (!cur)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-[#1a1a1a] text-white">
        <p className="text-[40px] font-bold">Selamat datang di Tirtonic</p>
        <p className="text-18 text-white/60">{branch}</p>
      </div>
    );

  return (
    <div className="h-screen overflow-hidden bg-black">
      {cur.isVideo ? (
        <video key={cur.id} src={cur.url} autoPlay muted playsInline loop={slides.length < 2} onEnded={() => setI((n) => n + 1)} className="h-full w-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- campaign dari storage
        <img key={cur.id} src={cur.url} alt="" className="h-full w-full object-cover" />
      )}
    </div>
  );
}
