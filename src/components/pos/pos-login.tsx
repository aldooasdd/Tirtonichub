"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { posLogin } from "@/server/actions/pos";

export function PosLogin() {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await posLogin(pw);
      if (r.ok) router.refresh();
      else setMsg(r.message ?? "Gagal masuk.");
    });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden w-[40%] flex-col justify-between bg-[#1a1a1a] p-12 text-white md:flex">
        <p className="text-24 font-bold">Tirtonichub.</p>
        <div className="space-y-3">
          <p className="text-[44px] font-bold leading-tight tracking-tight">Kasir toko</p>
          <p className="text-16 text-white/65">
            Login pakai password cabang.
            <br />
            Setelah itu karyawan tinggal ketuk namanya.
          </p>
        </div>
        <p className="text-12 text-white/40">Beta</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-[420px] space-y-5">
          <div>
            <h1 className="text-24 font-bold">Masuk mesin kasir</h1>
            <p className="text-16 text-muted-foreground">Masukkan password cabang. Cabang terbaca otomatis.</p>
          </div>
          <label className="block space-y-2">
            <span className="text-14 font-semibold">Password cabang</span>
            <div className="flex h-[52px] items-center rounded-md border-2 border-foreground px-4">
              <input
                autoFocus
                type={show ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="h-full flex-1 bg-transparent text-18 outline-none"
              />
              <button type="button" onClick={() => setShow(!show)} className="text-14 text-muted-foreground">
                {show ? "Sembunyikan" : "Lihat"}
              </button>
            </div>
          </label>
          {msg && <p className="text-14 text-destructive">{msg}</p>}
          <button
            disabled={pending || !pw}
            className="h-14 w-full rounded-md bg-primary text-18 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Memeriksa…" : "Masuk"}
          </button>
          <p className="text-12 text-muted-foreground">
            Tiap cabang punya password sendiri, diatur HR di Tirtonichub → Cabang. Ganti password = mesin cabang itu keluar.
          </p>
        </form>
      </div>
    </div>
  );
}
