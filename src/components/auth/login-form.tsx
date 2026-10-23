"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requestOtpAction, verifyOtpAction } from "@/server/actions/auth";

export function LoginForm() {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await requestOtpAction(email);
      if (r.ok) {
        setStep("otp");
        setCooldown(60);
        setMsg("Kode OTP dikirim ke WhatsApp kamu.");
      } else {
        setMsg(r.message ?? "Gagal.");
      }
    });
  }

  function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await verifyOtpAction(email, code);
      // sukses → server redirect. Hanya sampai sini kalau gagal.
      if (!r.ok) setMsg(r.message ?? "Kode salah.");
    });
  }

  function resend() {
    if (cooldown > 0) return;
    setMsg(null);
    start(async () => {
      await requestOtpAction(email);
      setCooldown(60);
      setMsg("Kode baru dikirim.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Masuk Tirtonic</CardTitle>
        <CardDescription>
          {step === "email"
            ? "Masukkan email kantor untuk menerima OTP via WhatsApp."
            : `Masukkan 6 digit kode yang dikirim ke WhatsApp untuk ${email}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "email" ? (
          <form onSubmit={submitEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="nama@tirtonichub.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {msg && <p className="text-14 text-muted-foreground">{msg}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Mengirim…" : "Kirim OTP"}
            </Button>
          </form>
        ) : (
          <form onSubmit={submitOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Kode OTP</Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            {msg && <p className="text-14 text-muted-foreground">{msg}</p>}
            <Button type="submit" className="w-full" disabled={pending || code.length !== 6}>
              {pending ? "Memverifikasi…" : "Masuk"}
            </Button>
            <div className="flex items-center justify-between text-14">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setMsg(null);
                }}
              >
                Ganti email
              </button>
              <button
                type="button"
                className="disabled:opacity-50"
                onClick={resend}
                disabled={cooldown > 0 || pending}
              >
                {cooldown > 0 ? `Kirim ulang (${cooldown}s)` : "Kirim ulang"}
              </button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
