"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { loginAction } from "@/server/actions/auth";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await loginAction(email, password);
      if (!r.ok) setMsg(r.message ?? "Gagal masuk.");
    });
  }

  const field =
    "h-12 w-full rounded-2xl border border-white/15 bg-white/10 pl-11 pr-11 text-white placeholder:text-white/50 outline-none backdrop-blur-xl transition focus:border-white/40 focus:bg-white/15";

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl">
      {/* kilau liquid glass */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-white/20 blur-3xl" />

      <div className="relative flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-lg backdrop-blur-xl">
          <Image src="/logo-ball.png" alt="Tirtonichub" width={40} height={40} className="h-10 w-10 object-contain" priority />
        </div>
        <h1 className="mt-4 text-24 font-semibold text-white">Masuk Tirtonichub</h1>
        <p className="mt-1 text-center text-14 text-white/60">Masukkan email kantor dan password kamu.</p>
      </div>

      <form onSubmit={submit} className="relative mt-6 space-y-3">
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50" />
          <input
            type="email"
            autoComplete="email"
            aria-label="Email"
            placeholder="Email"
            className={field}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50" />
          <input
            type={show ? "text" : "password"}
            autoComplete="current-password"
            aria-label="Password"
            placeholder="Password"
            className={field}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/60 transition hover:text-white"
          >
            {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        <div className="flex justify-end">
          <a href="/lupa-password" className="text-14 font-medium text-white/70 transition hover:text-white">
            Lupa password?
          </a>
        </div>

        {msg && <p className="text-14 text-red-300">{msg}</p>}

        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-2xl bg-black text-16 font-semibold text-white shadow-lg transition hover:bg-black/80 disabled:opacity-60"
        >
          {pending ? "Memeriksa…" : "Masuk"}
        </button>
      </form>
    </div>
  );
}
