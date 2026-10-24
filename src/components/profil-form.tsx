"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateOwnProfile } from "@/server/actions/profile";

// Field tema ditunda (fokus light). Tambahkan lagi saat dark diaktifkan.
export function ProfilForm({
  nickname: initNick,
  bio: initBio,
  birthDate: initBirth,
}: {
  nickname: string;
  bio: string;
  birthDate?: string;
  themePref?: "light" | "dark" | "system";
}) {
  const [nickname, setNickname] = useState(initNick);
  const [bio, setBio] = useState(initBio);
  const [birthDate, setBirthDate] = useState(initBirth ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await updateOwnProfile({ nickname, bio, birthDate });
      setMsg(r.ok ? "Tersimpan." : (r.message ?? "Gagal."));
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
          <Label>Tanggal lahir</Label>
          <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Bio singkat</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} />
        </div>
        {msg && <p className="text-14 text-muted-foreground">{msg}</p>}
        <Button onClick={submit} disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </section>
  );
}
