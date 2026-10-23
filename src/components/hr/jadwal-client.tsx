"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createSchedule, updateSchedule, deleteSchedule } from "@/server/actions/schedules";

const DAYS = [
  { n: 1, label: "Sen" },
  { n: 2, label: "Sel" },
  { n: 3, label: "Rab" },
  { n: 4, label: "Kam" },
  { n: 5, label: "Jum" },
  { n: 6, label: "Sab" },
  { n: 7, label: "Min" },
];

type Row = {
  id: string;
  name: string;
  workDays: number[];
  startTime: string;
  endTime: string;
  lateToleranceMin: number;
  userCount: number;
};

export function JadwalClient({ schedules }: { schedules: Row[] }) {
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();

  function remove(row: Row) {
    if (!confirm(`Hapus jadwal "${row.name}"?`)) return;
    start(async () => {
      const r = await deleteSchedule(row.id);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-24 font-semibold">Jadwal Kerja</h1>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {schedules.length === 0 && (
          <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground sm:col-span-2">
            Belum ada jadwal.
          </p>
        )}
        {schedules.map((s) => (
          <div key={s.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-14 text-muted-foreground">
                  {s.startTime}–{s.endTime} · toleransi {s.lateToleranceMin}m
                </p>
              </div>
              <span className="text-12 text-muted-foreground">{s.userCount} org</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {DAYS.map((d) => (
                <span
                  key={d.n}
                  className={`rounded-sm px-1.5 py-0.5 text-12 ${
                    s.workDays.includes(d.n)
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {d.label}
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setEditing(s);
                  setOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => remove(s)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <JadwalDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function JadwalDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Row | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [workDays, setWorkDays] = useState<number[]>(editing?.workDays ?? [1, 2, 3, 4, 5]);
  const [startTime, setStart] = useState(editing?.startTime ?? "09:00");
  const [endTime, setEnd] = useState(editing?.endTime ?? "17:00");
  const [tol, setTol] = useState(String(editing?.lateToleranceMin ?? 10));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggleDay(n: number) {
    setWorkDays((prev) => (prev.includes(n) ? prev.filter((d) => d !== n) : [...prev, n]));
  }

  function submit() {
    setMsg(null);
    start(async () => {
      const input = {
        name,
        workDays: [...workDays].sort(),
        startTime,
        endTime,
        lateToleranceMin: Number(tol) || 0,
      };
      const r = editing ? await updateSchedule(editing.id, input) : await createSchedule(input);
      if (r.ok) onSaved();
      else setMsg(r.message ?? "Gagal.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Jadwal" : "Tambah Jadwal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nama</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Reguler 09:00–17:00" />
          </div>
          <div className="space-y-2">
            <Label>Hari kerja</Label>
            <div className="flex flex-wrap gap-3">
              {DAYS.map((d) => (
                <label key={d.n} className="flex items-center gap-1.5 text-14">
                  <Checkbox checked={workDays.includes(d.n)} onCheckedChange={() => toggleDay(d.n)} />
                  {d.label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Jam masuk</Label>
              <Input type="time" value={startTime} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Jam pulang</Label>
              <Input type="time" value={endTime} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Toleransi terlambat (menit)</Label>
            <Input type="number" value={tol} onChange={(e) => setTol(e.target.value)} />
          </div>
          {msg && <p className="text-14 text-destructive">{msg}</p>}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
