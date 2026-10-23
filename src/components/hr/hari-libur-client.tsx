"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtWIB } from "@/lib/datetime";
import { createHoliday, deleteHoliday } from "@/server/actions/schedules";

type Row = { id: string; date: string; name: string };

export function HariLiburClient({ holidays }: { holidays: Row[] }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const [pending, start] = useTransition();

  function add() {
    setMsg(null);
    start(async () => {
      const r = await createHoliday({ date, name });
      if (r.ok) {
        setOpen(false);
        setDate("");
        setName("");
        router.refresh();
      } else setMsg(r.message ?? "Gagal.");
    });
  }

  function remove(id: string) {
    if (!confirm("Hapus hari libur ini?")) return;
    start(async () => {
      await deleteHoliday(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-24 font-semibold">Hari Libur</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {holidays.length === 0 && (
          <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">
            Belum ada hari libur.
          </p>
        )}
        {holidays.map((h) => (
          <div key={h.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div>
              <p className="font-medium">{h.name}</p>
              <p className="text-14 text-muted-foreground">{fmtWIB(h.date + "T00:00:00+07:00")}</p>
            </div>
            <Button variant="ghost" size="icon" disabled={pending} onClick={() => remove(h.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Hari Libur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Idul Fitri" />
            </div>
            {msg && <p className="text-14 text-destructive">{msg}</p>}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={add} disabled={pending || !date || !name}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
