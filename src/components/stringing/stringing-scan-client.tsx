"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { finishStringingScan } from "@/server/actions/stringing";

export function StringingScanClient({
  embedded = false,
  onDone,
}: {
  embedded?: boolean;
  onDone?: (resultCode?: string) => void;
} = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
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

  // Fallback: ambil 1 foto barcode lalu decode (buat browser yang blokir kamera live).
  async function decodePhoto(file: File) {
    setMsg(null);
    setBusy(true);
    try {
      const bmp = await createImageBitmap(file);
      const canvas = (canvasRef.current ??= document.createElement("canvas"));
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("no ctx");
      ctx.drawImage(bmp, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height);
      setBusy(false);
      if (code?.data) return submit(code.data);
      setMsg({ ok: false, text: "QR tak terbaca dari foto. Coba lagi / isi manual." });
    } catch {
      setBusy(false);
      setMsg({ ok: false, text: "Gagal baca foto. Isi manual." });
    }
  }

  async function startScan() {
    setMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      // Browser tanpa kamera live → pakai ambil foto.
      photoRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setScanning(true);
      // Decode QR tiap 250ms dari frame video (jsQR — jalan di semua browser).
      timerRef.current = window.setInterval(() => {
        const v = videoRef.current;
        if (!v || !v.videoWidth) return;
        const canvas = (canvasRef.current ??= document.createElement("canvas"));
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height);
        if (code?.data) submit(code.data);
      }, 250);
    } catch {
      // Kamera ditolak/diblokir → fallback ambil foto.
      stop();
      photoRef.current?.click();
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

        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && decodePhoto(e.target.files[0])}
        />
        {scanning ? (
          <Button variant="outline" className="w-full" onClick={stop}>Stop</Button>
        ) : (
          <div className="flex gap-2">
            <Button className="flex-1" disabled={busy} onClick={startScan}>
              {busy ? "Memproses…" : "Scan barcode raket"}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => photoRef.current?.click()}>
              Foto barcode
            </Button>
          </div>
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
