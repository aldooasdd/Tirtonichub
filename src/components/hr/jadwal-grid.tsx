"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SHIFTS, SHIFT_ORDER, type ShiftCode } from "@/lib/shift";
import { saveShifts, type Cell } from "@/server/actions/shifts";

type Emp = { id: string; name: string; role: string };
const DOW = ["Mg", "Sn", "Sl", "Rb", "Km", "Jm", "Sb"];

export function JadwalGrid({
  ym,
  days,
  branchId,
  branches,
  employees,
  initialCells,
  defaults = {},
}: {
  ym: string;
  days: number;
  branchId: string;
  branches: { id: string; name: string }[];
  employees: Emp[];
  initialCells: Record<string, string>;
  defaults?: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [cells, setCells] = useState<Record<string, string>>(initialCells);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  const [y, m] = ym.split("-").map(Number);
  const dowOf = (d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  function go(next: { ym?: string; branch?: string }) {
    const p = new URLSearchParams({ ym, branch: branchId, ...next });
    router.push(`${pathname}?${p.toString()}`);
  }

  const shown = (k: string) => cells[k] ?? defaults[k] ?? "";

  function setCell(empId: string, day: number, code: string) {
    const k = `${empId}:${day}`;
    setCells((c) => ({ ...c, [k]: code }));
    setDirty((d) => new Set(d).add(k));
  }

  function save() {
    if (dirty.size === 0) return;
    const payload: Cell[] = [...dirty].map((k) => {
      const [userId, day] = k.split(":");
      return { userId, day: Number(day), code: cells[k] ?? "" };
    });
    start(async () => {
      const r = await saveShifts(ym, payload);
      if (!r.ok) {
        setMsg(r.message ?? "Gagal simpan.");
        return;
      }
      setDirty(new Set());
      setMsg("Tersimpan.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Jadwal Kerja</h1>
          <p className="text-14 text-muted-foreground">Klik sel untuk ganti shift. Simpan saat selesai.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={ym}
            onChange={(e) => go({ ym: e.target.value })}
            className="h-9 rounded-md border bg-background px-3 text-14"
          />
          <select
            value={branchId}
            onChange={(e) => go({ branch: e.target.value })}
            className="h-9 rounded-md border bg-background px-3 text-14"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <Button disabled={pending || dirty.size === 0} onClick={save}>
            {pending ? "Menyimpan…" : dirty.size > 0 ? `Simpan (${dirty.size})` : "Simpan"}
          </Button>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-1.5 text-11">
        {SHIFT_ORDER.map((c) => (
          <span key={c} className={cn("rounded px-1.5 py-0.5 font-medium", SHIFTS[c].cls)}>
            {c} · {SHIFTS[c].label}
          </span>
        ))}
      </div>
      {msg && <p className="text-12 text-muted-foreground">{msg}</p>}

      {employees.length === 0 ? (
        <p className="rounded-lg border bg-card py-8 text-center text-muted-foreground">Tak ada karyawan di cabang ini.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="border-collapse text-12">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-40 border-b border-r bg-card px-3 py-2 text-left font-medium">Karyawan</th>
                {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
                  const wd = dowOf(d);
                  const weekend = wd === 0;
                  return (
                    <th key={d} className={cn("border-b border-l px-1 py-1 text-center font-medium", weekend && "bg-rose-500/10")}>
                      <div>{d}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">{DOW[wd]}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="sticky left-0 z-10 border-b border-r bg-card px-3 py-1.5">
                    <div className="font-medium">{e.name}</div>
                    <div className="text-[10px] text-muted-foreground">{e.role}</div>
                  </td>
                  {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
                    const code = shown(`${e.id}:${d}`);
                    const def = code ? SHIFTS[code as ShiftCode] : null;
                    return (
                      <td key={d} className="border-b border-l p-0 text-center">
                        <select
                          value={code}
                          onChange={(ev) => setCell(e.id, d, ev.target.value)}
                          className={cn("h-9 w-11 cursor-pointer appearance-none text-center text-[11px] font-semibold outline-none", def?.cls)}
                        >
                          <option value="">—</option>
                          {SHIFT_ORDER.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
