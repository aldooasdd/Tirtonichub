"use client";

import Script from "next/script";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sambungWa, ubahLabelWa } from "@/server/actions/wa-sambung";

type FB = { init: (o: object) => void; login: (cb: (r: { authResponse?: { code?: string } }) => void, o: object) => void };
type W = Window & { FB?: FB; fbAsyncInit?: () => void };

export function SambungWa({ appId, configId, nomor }: { appId: string; configId: string; nomor: { phoneNumberId: string; label: string; displayPhone: string | null }[] }) {
  const router = useRouter();
  const [label, setLabel] = useState(`Admin ${nomor.length + 1}`);
  const [siap, setSiap] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const sesi = useRef<{ code?: string; phoneNumberId?: string; wabaId?: string; label?: string }>({});

  const selesai = () => {
    const s = sesi.current;
    if (!s.code || !s.phoneNumberId || !s.wabaId) return;
    sesi.current = { label: s.label };
    start(async () => {
      const r = await sambungWa({ code: s.code!, phoneNumberId: s.phoneNumberId!, wabaId: s.wabaId!, label: s.label ?? "Admin" });
      setMsg({ ok: r.ok, text: r.message });
      router.refresh();
    });
  };

  useEffect(() => {
    const w = window as W;
    w.fbAsyncInit = () => { w.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version: "v23.0" }); setSiap(true); };
    if (w.FB) w.fbAsyncInit();
    // Embedded Signup mengirim phone_number_id & waba_id lewat postMessage
    const onMsg = (e: MessageEvent) => {
      if (!/(^|\.)facebook\.com$/.test(new URL(e.origin).hostname)) return;
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (d?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (String(d.event).startsWith("FINISH")) { sesi.current.phoneNumberId = d.data?.phone_number_id; sesi.current.wabaId = d.data?.waba_id; selesai(); }
        else if (d.event === "CANCEL") setMsg({ ok: false, text: `Dibatalkan${d.data?.current_step ? ` di langkah ${d.data.current_step}` : ""}.` });
        else if (d.event === "ERROR") setMsg({ ok: false, text: `Meta: ${d.data?.error_message ?? "gagal"}` });
      } catch {}
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dipasang sekali
  }, [appId]);

  const mulai = () => {
    setMsg(null);
    sesi.current = { label };
    (window as W).FB?.login(
      (r) => { if (r.authResponse?.code) { sesi.current.code = r.authResponse.code; selesai(); } else setMsg({ ok: false, text: "Login Meta dibatalkan." }); },
      { config_id: configId, response_type: "code", override_default_response_type: true, extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" } },
    );
  };

  return (
    <div className="space-y-4">
      <Script src="https://connect.facebook.net/en_US/sdk.js" strategy="afterInteractive" crossOrigin="anonymous" />
      {nomor.length > 0 && (
        <div className="divide-y rounded-lg border bg-card">
          {nomor.map((n) => (
            <div key={n.phoneNumberId} className="flex items-center gap-3 p-3 text-14">
              <input defaultValue={n.label} onBlur={(e) => e.target.value !== n.label && void ubahLabelWa(n.phoneNumberId, e.target.value)} aria-label="Nama nomor" className="h-9 w-40 rounded-md border bg-background px-2" />
              <span className="text-muted-foreground">{n.displayPhone ?? n.phoneNumberId}</span>
              <span className="ml-auto text-12 text-emerald-600">Tersambung</span>
            </div>
          ))}
        </div>
      )}
      {!configId ? (
        <p className="rounded-md bg-amber-500/10 p-3 text-14 text-amber-700">ID Konfigurasi Embedded Signup belum diisi. Buat konfigurasi di app Meta (Facebook Login for Business → Konfigurasi → WhatsApp Embedded Signup).</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-12 text-muted-foreground">
            Nama nomor di Inbox
            <input value={label} onChange={(e) => setLabel(e.target.value)} className="h-10 w-48 rounded-md border bg-background px-3 text-14 text-foreground" />
          </label>
          <button type="button" onClick={mulai} disabled={!siap || busy} className="h-10 rounded-md bg-emerald-600 px-4 font-medium text-white disabled:opacity-40">
            {busy ? "Menyambungkan…" : siap ? "Sambungkan WhatsApp" : "Memuat…"}
          </button>
        </div>
      )}
      {msg && <p role="status" className={`rounded-md px-3 py-2 text-14 ${msg.ok ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>}
    </div>
  );
}
