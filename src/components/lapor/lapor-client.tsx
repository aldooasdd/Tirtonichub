"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/image";
import { submitReport } from "@/server/actions/reports";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

export function LaporClient() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit() {
    if (!message.trim()) {
      setMsg("Keterangan wajib diisi.");
      return;
    }
    setBusy(true);
    setMsg("");
    let imageBase64: string | null = null;
    if (file) imageBase64 = await blobToBase64(await compressImage(file));
    const r = await submitReport({ message, imageBase64, mimeType: "image/jpeg" });
    setBusy(false);
    if (!r.ok) {
      setMsg(r.message ?? "Gagal kirim.");
      return;
    }
    setMessage("");
    setFile(null);
    setMsg("Laporan terkirim ke Admin. Terima kasih.");
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-24 font-semibold">Lapor</h1>
        <p className="text-14 text-muted-foreground">
          Ada error atau pertanyaan? Tulis keterangan + lampirkan screenshot, Admin akan menanganinya.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-4">
        <label className="block space-y-1">
          <span className="block text-12 text-muted-foreground">Keterangan (kenapa / apa masalahnya)</span>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Jelaskan error atau pertanyaanmu…" />
        </label>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex items-center gap-3">
          <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
            {file ? "Ganti screenshot" : "Lampirkan screenshot"}
          </Button>
          {file && <span className="truncate text-12 text-muted-foreground">{file.name}</span>}
        </div>

        {msg && <p className="text-12 text-muted-foreground">{msg}</p>}
        <Button disabled={busy || !message.trim()} onClick={submit}>
          {busy ? "Mengirim…" : "Kirim ke Admin"}
        </Button>
      </div>
    </div>
  );
}
