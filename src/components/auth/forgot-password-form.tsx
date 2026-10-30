"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requestPasswordOtp, resetPasswordWithOtp } from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [wa, setWa] = useState("");
  const [otp, setOtp] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const [pending, start] = useTransition();

  function kirimOtp(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(false);
    start(async () => {
      const r = await requestPasswordOtp(wa);
      if (!r.ok) {
        setErr(true);
        setMsg(r.message ?? "Gagal kirim OTP.");
        return;
      }
      setStep(2);
      setMsg("Kalau nomor terdaftar, OTP sudah dikirim ke WhatsApp. Berlaku 10 menit.");
    });
  }

  function resetPass(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(false);
    start(async () => {
      const r = await resetPasswordWithOtp(wa, otp, pass, confirm);
      if (!r.ok) {
        setErr(true);
        setMsg(r.message ?? "Gagal reset.");
        return;
      }
      router.push("/login");
    });
  }

  return (
    <Card className="dark border-white/10 bg-white/10 text-white shadow-2xl backdrop-blur-2xl">
      <CardHeader>
        <CardTitle>Lupa Password</CardTitle>
        <CardDescription className="text-white/60">
          {step === 1 ? "Masukkan nomor WhatsApp kamu. OTP dikirim ke WA." : "Masukkan OTP dari WhatsApp lalu password baru."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 1 ? (
          <form onSubmit={kirimOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wa">Nomor WhatsApp</Label>
              <Input
                id="wa"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="08xxxxxxxxxx"
                value={wa}
                onChange={(e) => setWa(e.target.value)}
                required
              />
            </div>
            {msg && <p className={`text-14 ${err ? "text-destructive" : "text-white/70"}`}>{msg}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Mengirim…" : "Kirim OTP"}
            </Button>
          </form>
        ) : (
          <form onSubmit={resetPass} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Kode OTP</Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="6 digit"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pass">Password baru</Label>
              <Input
                id="pass"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Konfirmasi password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            {msg && <p className={`text-14 ${err ? "text-destructive" : "text-white/70"}`}>{msg}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Menyimpan…" : "Ganti Password"}
            </Button>
            <p className="text-center text-13 text-white/60">
              <button type="button" onClick={() => { setStep(1); setMsg(null); setErr(false); }} className="underline hover:text-white">
                Kirim ulang / ganti nomor
              </button>
            </p>
          </form>
        )}
        <p className="mt-4 text-center text-13 text-white/60">
          <a href="/login" className="underline hover:text-white">Kembali ke login</a>
        </p>
      </CardContent>
    </Card>
  );
}
