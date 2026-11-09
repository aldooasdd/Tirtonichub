"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { returnAccept, returnConfirm, returnDispute, returnImage, returnOffer, returnProof } from "@/server/actions/shopee-returns";
import type { DisputeReason, Solutions } from "@/server/marketplace/shopee-returns";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
const field = "h-9 rounded-md border bg-background px-2 text-14";
const btn = "h-9 rounded-md border px-3 text-14 font-medium disabled:opacity-40";
const primary = "h-9 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground disabled:opacity-40";
type Photo = { url: string; thumbnail: string };

/** Aksi retur Shopee: setujui, tawar, terima tawaran, sanggah, kirim bukti. */
export function ReturnActions({ sn, refund, solutions, reasons, canAccept }: { sn: string; refund: number; solutions: Solutions | null; reasons: DisputeReason[]; canAccept: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sol, setSol] = useState<"return_refund" | "refund">(solutions?.refund.ok ? "refund" : "return_refund");
  const [amount, setAmount] = useState("");
  const [reasonId, setReasonId] = useState(reasons[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [desc, setDesc] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, q?: string, after?: () => void) => {
    if (q && !confirm(q)) return;
    start(async () => {
      const r = await fn().catch(() => ({ ok: false, message: "Gagal. Muat ulang halaman." }));
      setMsg({ ok: r.ok, text: r.message ?? "" });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  };
  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    start(async () => {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", file);
        const r = await returnImage(sn, fd);
        if (!r.ok || !r.data) return setMsg({ ok: false, text: r.message ?? "Upload gagal." });
        const d = r.data;
        setPhotos((p) => [...p, d]);
      }
    });
  };
  const opt = sol === "refund" ? solutions?.refund : solutions?.returnRefund;
  const reason = reasons.find((r) => r.id === reasonId);

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap gap-2 rounded-lg border bg-card p-4">
        <button className={primary} disabled={pending} onClick={() => run(() => returnConfirm(sn), `Setujui retur & kembalikan dana ${rupiah(refund)} ke pembeli?`)}>
          Setujui retur
        </button>
        {canAccept && (
          <button className={btn} disabled={pending} onClick={() => run(() => returnAccept(sn), "Terima tawaran terakhir pembeli?")}>
            Terima tawaran pembeli
          </button>
        )}
      </section>

      {solutions && (solutions.refund.ok || solutions.returnRefund.ok) && (
        <section className="space-y-2 rounded-lg border bg-card p-4">
          <p className="text-14 font-medium">Tawarkan solusi lain</p>
          <div className="flex flex-wrap items-end gap-2">
            <select value={sol} onChange={(e) => setSol(e.target.value as "return_refund" | "refund")} className={field}>
              {solutions.refund.ok && <option value="refund">Pengembalian dana saja (barang tidak dikirim balik)</option>}
              {solutions.returnRefund.ok && <option value="return_refund">Kembalikan barang & dana</option>}
            </select>
            {opt?.adjustable && (
              <label className="flex flex-col gap-1 text-12 text-muted-foreground">
                Jumlah dana ({rupiah(opt.min)} – {rupiah(opt.max)})
                <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} className={`${field} w-40`} />
              </label>
            )}
            <button
              className={btn}
              disabled={pending || (opt?.adjustable && !amount)}
              onClick={() => run(() => returnOffer(sn, sol, opt?.adjustable ? Number(amount) : undefined), "Kirim penawaran ke pembeli?")}
            >
              Kirim penawaran
            </button>
          </div>
        </section>
      )}

      <section className="space-y-2 rounded-lg border bg-card p-4">
        <p className="text-14 font-medium">Foto bukti</p>
        <input type="file" accept="image/jpeg,image/png" multiple disabled={pending} onChange={(e) => upload(e.target.files)} className="text-14" />
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element -- foto dari server Shopee
              <img key={p.url} src={p.thumbnail} alt="" className="size-16 rounded-md border object-cover" />
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Keterangan bukti (opsional)" className={`${field} min-w-60 flex-1`} />
          <button className={btn} disabled={pending || !photos.length} onClick={() => run(() => returnProof(sn, photos, desc || undefined), "Kirim foto bukti ke Shopee?")}>
            Kirim bukti
          </button>
        </div>
      </section>

      {reasons.length > 0 && (
        <section className="space-y-2 rounded-lg border bg-card p-4">
          <p className="text-14 font-medium">Sanggah retur</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <select value={reasonId} onChange={(e) => setReasonId(e.target.value)} className={field}>
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>{r.reason}</option>
              ))}
            </select>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email untuk dihubungi Shopee" className={field} />
          </div>
          {reason?.requirement && <p className="text-12 text-muted-foreground">{reason.requirement}</p>}
          {reason?.modules.map((m) => (
            <p key={m.index} className="text-12 text-muted-foreground">
              Bukti {m.index}: {m.requirement}
              {m.required ? " (wajib)" : ""}
            </p>
          ))}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Alasan sanggahan" className="w-full rounded-md border bg-background p-2 text-14" />
          <p className="text-12 text-muted-foreground">Foto bukti yang sudah diupload di atas ikut dikirim.</p>
          <button
            className={`${btn} text-destructive`}
            disabled={pending || !reasonId || !email}
            onClick={() =>
              run(
                () =>
                  returnDispute({
                    sn,
                    email,
                    reasonId,
                    text: text || undefined,
                    images: photos.length ? (reason?.modules.length ? reason.modules : [{ index: 1, requirement: "", required: false }]).slice(0, 1).map((m) => ({ index: m.index, requirement: m.requirement, urls: photos.map((p) => p.url) })) : undefined,
                  }),
                "Kirim sanggahan ke Shopee?",
              )
            }
          >
            Kirim sanggahan
          </button>
        </section>
      )}
      {msg && <p className={`text-14 ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
    </div>
  );
}
