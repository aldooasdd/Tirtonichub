"use client";

import { useState, useTransition } from "react";
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
import { loginAction } from "@/server/actions/auth";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await loginAction(email, password);
      // sukses → server redirect. Sampai sini hanya kalau gagal.
      if (!r.ok) setMsg(r.message ?? "Gagal masuk.");
    });
  }

  return (
    <Card className="dark border-white/10 bg-white/10 text-white shadow-2xl backdrop-blur-2xl">
      <CardHeader>
        <CardTitle>Masuk Tirtonichub.</CardTitle>
        <CardDescription className="text-white/60">Masukkan email kantor dan password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
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
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {msg && <p className="text-14 text-destructive">{msg}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Memeriksa…" : "Masuk"}
          </Button>
          <p className="text-center text-13 text-white/60">
            <a href="/lupa-password" className="underline hover:text-white">Lupa password?</a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
