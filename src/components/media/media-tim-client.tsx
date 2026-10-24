"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MediaRole } from "@/generated/prisma";
import { upsertMember } from "@/server/actions/media-members";

type M = { userId: string; name: string; code: string; role: MediaRole; idcc: boolean; offDays: number[]; phone: string; exists: boolean };

const DOW = [
  [1, "Sen"], [2, "Sel"], [3, "Rab"], [4, "Kam"], [5, "Jum"], [6, "Sab"], [0, "Min"],
] as const;
const ROLE_LBL: Record<MediaRole, string> = { ADMIN: "Admin penuh", ADMIN2: "Admin 2", MEMBER: "Anggota" };
const sel = "h-9 rounded-md border bg-background px-2 text-14";

export function MediaTimClient({ members, full }: { members: M[]; full: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [d, setD] = useState<Record<string, Partial<M>>>({});
  const v = <K extends keyof M>(m: M, k: K): M[K] => (d[m.userId]?.[k] as M[K]) ?? m[k];
  const set = (id: string, k: keyof M, val: unknown) => setD((s) => ({ ...s, [id]: { ...s[id], [k]: val } }));

  function save(m: M) {
    start(async () => {
      const r = await upsertMember(m.userId, {
        code: v(m, "code"),
        role: v(m, "role"),
        idcc: v(m, "idcc"),
        offDays: v(m, "offDays"),
        phone: v(m, "phone"),
      });
      if (!r.ok) {
        alert(r.message);
        return;
      }
      router.refresh();
    });
  }
  function toggleOff(m: M, day: number) {
    const cur = v(m, "offDays");
    set(m.userId, "offDays", cur.includes(day) ? cur.filter((x) => x !== day) : [...cur, day]);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-24 font-semibold">Tim Media</h1>
        <p className="text-14 text-muted-foreground">Kode orang (Z/R/A/S), peran, izin Analisis IDCC, dan hari libur mingguan. {full ? "" : "Hanya admin penuh yang bisa mengubah."}</p>
      </div>

      {members.length === 0 && <p className="rounded-lg border bg-card py-8 text-center text-muted-foreground">Belum ada user dengan role Media.</p>}

      {members.map((m) => (
        <div key={m.userId} className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">{m.name}{!m.exists && <span className="ml-2 text-11 text-amber-600">belum diatur</span>}</p>
          </div>
          {full ? (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-11 text-muted-foreground">Kode</span>
                  <Input className="w-20" value={v(m, "code")} maxLength={4} onChange={(e) => set(m.userId, "code", e.target.value.toUpperCase())} placeholder="Z" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-11 text-muted-foreground">Peran</span>
                  <select className={sel} value={v(m, "role")} onChange={(e) => set(m.userId, "role", e.target.value as MediaRole)}>
                    {(["ADMIN", "ADMIN2", "MEMBER"] as MediaRole[]).map((r) => <option key={r} value={r}>{ROLE_LBL[r]}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 pb-2 text-14">
                  <input type="checkbox" checked={v(m, "idcc")} onChange={(e) => set(m.userId, "idcc", e.target.checked)} />
                  Izin Analisis IDCC
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-11 text-muted-foreground">No. WA (opsional)</span>
                  <Input value={v(m, "phone")} onChange={(e) => set(m.userId, "phone", e.target.value)} placeholder="08…" />
                </label>
              </div>
              <div className="space-y-1">
                <span className="text-11 text-muted-foreground">Hari libur mingguan</span>
                <div className="flex flex-wrap gap-1">
                  {DOW.map(([day, lbl]) => (
                    <button key={day} type="button" onClick={() => toggleOff(m, day)}
                      className={`rounded-md border px-2 py-1 text-12 ${v(m, "offDays").includes(day) ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <Button size="sm" disabled={pending} onClick={() => save(m)}>Simpan</Button>
            </>
          ) : (
            <p className="text-14 text-muted-foreground">
              {m.exists ? `${m.code} · ${ROLE_LBL[m.role]}${m.idcc ? " · IDCC" : ""}` : "Belum diatur admin."}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
