"use client";

import { useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateOwnProfile } from "@/server/actions/profile";

type ThemePref = "light" | "dark" | "system";

export function ProfilForm({
  nickname: initNick,
  bio: initBio,
  themePref: initTheme,
}: {
  nickname: string;
  bio: string;
  themePref: ThemePref;
}) {
  const [nickname, setNickname] = useState(initNick);
  const [bio, setBio] = useState(initBio);
  const [themePref, setThemePref] = useState<ThemePref>(initTheme);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { setTheme } = useTheme();

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await updateOwnProfile({ nickname, bio, themePref });
      if (r.ok) {
        setTheme(themePref);
        setMsg("Tersimpan.");
      } else {
        setMsg(r.message ?? "Gagal.");
      }
    });
  }

  return (
    <section className="rounded-lg bg-card p-5">
      <h2 className="mb-4 font-semibold">Edit profil</h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nama panggilan</Label>
          <Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Bio singkat</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} />
        </div>
        <div className="space-y-2">
          <Label>Tema</Label>
          <Select value={themePref} onValueChange={(v) => setThemePref(v as ThemePref)}>
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">Ikut sistem</SelectItem>
              <SelectItem value="light">Terang</SelectItem>
              <SelectItem value="dark">Gelap</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {msg && <p className="text-14 text-muted-foreground">{msg}</p>}
        <Button onClick={submit} disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </section>
  );
}
