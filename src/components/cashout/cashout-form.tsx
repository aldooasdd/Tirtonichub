"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { saveCashout, scanCashoutNota } from "@/server/actions/cashout";

type Row = { id: string; spentAt: string; amount: number; description: string; branch: string; approved: boolean };

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);

export function CashoutForm({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [when, setWhen] = useState("");
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setMsg(null);
    setScanning(true);
    const r = new FileReader();
    r.onload = async () => {
      const b64 = String(r.result).split(",")[1] ?? "";
      const res = await scanCashoutNota(b64, f.type || "image/jpeg");
      setScanning(false);
      if (!res.ok || !res.photoKey) {
        setMsg(res.message ?? "Scan gagal.");
        return;
      }
      setPhotoKey(res.photoKey);
      if (res.parsed) {
        if (res.parsed.amount) setAmount(String(res.parsed.amount));
        if (res.parsed.description) setDesc(res.parsed.description);
        if (res.parsed.spentAt) setWhen(res.parsed.spentAt.slice(0, 16));
      }
      setMsg(res.ocr ? "Nota terbaca. Periksa & edit bila perlu." : "Foto tersimpan. Isi manual (OCR tak membaca).");
    };
    r.readAsDataURL(f);
  }

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await saveCashout({
        amount: Number(amount),
        description: desc,
        spentAt: when ? new Date(when).toISOString() : null,
        photoKey,
      });
      if (!r.ok) {
        setMsg(r.message ?? "Gagal.");
        return;
      }
      setAmount("");
      setDesc("");
      setWhen("");
      setPhotoKey(null);
      setMsg("Terkirim. Menunggu ACC Finance.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <h1 className="text-24 font-semibold">Input Pembelian / Pengeluaran</h1>

      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="space-y-2">
          <Label>Scan nota pembelian</Label>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
          <Button type="button" variant="outline" className="w-full" disabled={scanning} onClick={() => fileRef.current?.click()}>
            <Camera className="h-4 w-4" /> {scanning ? "Membaca nota…" : photoKey ? "Nota terbaca · scan ulang" : "Foto nota pembelian"}
          </Button>
        </div>
        <div className="space-y-2">
          <Label>Jumlah (Rp)</Label>
          <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label>Keterangan</Label>
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Beli apa / untuk apa" rows={2} />
        </div>
        <div className="space-y-2">
          <Label>Tanggal (opsional)</Label>
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
        {msg && <p className="text-14 text-muted-foreground">{msg}</p>}
        <Button className="w-full" disabled={pending || scanning || !amount || !desc} onClick={submit}>
          {pending ? "Mengirim…" : "Kirim ke Finance"}
        </Button>
      </div>

      <div className="space-y-2">
        <h2 className="text-14 font-semibold">Pengeluaran saya</h2>
        {rows.length === 0 && <p className="rounded-lg border bg-card py-8 text-center text-muted-foreground">Belum ada.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
            <div>
              <p className="font-medium">{rupiah(r.amount)}</p>
              <p className="text-13 text-muted-foreground">{r.spentAt} · {r.description}</p>
            </div>
            <Badge variant={r.approved ? "default" : "secondary"}>{r.approved ? "Masuk Finance" : "Menunggu ACC"}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
