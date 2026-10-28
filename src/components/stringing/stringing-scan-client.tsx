"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { finishStringingScan } from "@/server/actions/stringing";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function StringingScanClient({
  embedded = false,
  onDone,
}: {
  embedded?: boolean;
  onDone?: (resultCode?: string) => void;
} = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const hasDetector = typeof window !== "undefined" && "BarcodeDetector" in window;

  function stop() {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  useEffect(() => stop, []);

  async function submit(value: string) {
    if (!value.trim() || busy) return;
    stop();
    setBusy(true);
    setMsg(null);
    const r = await finishStringingScan(value);
    setBusy(false);
    setMsg({ ok: r.ok, text: r.message });
    if (r.ok) onDone?.(r.resultCode);
  }

  async function startScan() {
    setMsg(null);
    if (!hasDetector) {
      setMsg({ ok: false, text: "Kamera scan tak didukung browser ini. Pakai input manual." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes[0]?.rawValue) {
            submit(codes[0].rawValue);
            return;
          }
        } catch {
          /* frame belum siap */
        }
        loopRef.current = requestAnimationFrame(tick);
      };
      loopRef.current = requestAnimationFrame(tick);
    } catch {
      setMsg({ ok: false, text: "Gagal buka kamera." });
      stop();
    }
  }

  return (
    <div className={embedded ? "space-y-4" : "mx-auto max-w-lg space-y-5"}>
      {!embedded && (
        <div>
          <h1 className="text-24 font-semibold">Scan Stringing Selesai</h1>
          <p className="text-14 text-muted-foreground">
            Selesai senar &amp; print stiker, scan barcode raket di sini — status di tirtonic.com langsung Selesai + WA ke customer.
          </p>
        </div>
      )}

      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          {!scanning && (
            <div className="absolute inset-0 flex items-center justify-center text-13 text-white/70">
              Kamera mati
            </div>
          )}
        </div>

        {scanning ? (
          <Button variant="outline" className="w-full" onClick={stop}>Stop</Button>
        ) : (
          <Button className="w-full" disabled={busy} onClick={startScan}>
            {busy ? "Memproses…" : "Scan barcode raket"}
          </Button>
        )}

        <div className="space-y-1">
          <span className="block text-12 text-muted-foreground">Atau isi nomor HP / tempel link manual</span>
          <div className="flex gap-2">
            <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="08xxxx atau link riwayat" />
            <Button variant="outline" disabled={busy} onClick={() => submit(manual)}>Kirim</Button>
          </div>
        </div>

        {msg && (
          <p className={`text-14 font-medium ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>
        )}
      </div>
    </div>
  );
}
