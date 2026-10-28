"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REQ_TYPE_LABEL, REQ_STATUS_LABEL, statusBadgeVariant } from "@/lib/request-labels";
import { createRequest, cancelRequest, respondRequest } from "@/server/actions/requests";

type Emp = { id: string; fullName: string };
type Incoming = { id: string; requester: string; label: string; date: string; reason: string };

type Row = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  reviewNote: string | null;
  swap?: { counterpart: string; approved: boolean } | null;
};

const TYPES = ["LEAVE", "PERMIT", "SICK", "SHIFT_SWAP", "ATTENDANCE_CORRECTION"] as const;

export function PengajuanClient({
  requests,
  employees,
  incoming,
}: {
  requests: Row[];
  employees: Emp[];
  incoming: Incoming[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();

  function cancel(id: string) {
    if (!confirm("Batalkan pengajuan ini?")) return;
    start(async () => {
      const r = await cancelRequest(id);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }

  function respond(id: string, agree: boolean) {
    start(async () => {
      const r = await respondRequest(id, agree);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-24 font-semibold">Pengajuan</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Ajukan
        </Button>
      </div>

      {incoming.length > 0 && (
        <div className="space-y-2 rounded-lg border bg-card p-4">
          <p className="text-14 font-medium">Perlu persetujuanmu (jadi pengganti)</p>
          {incoming.map((it) => (
            <div key={it.id} className="rounded-md border p-3">
              <p className="text-14">
                <span className="font-medium">{it.requester}</span> minta kamu jadi pengganti ({it.label}) tgl {it.date}
              </p>
              <p className="text-13 text-muted-foreground">{it.reason}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" disabled={pending} onClick={() => respond(it.id, true)}>
                  Setuju
                </Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => respond(it.id, false)}>
                  Tolak
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {requests.length === 0 && (
          <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">
            Belum ada pengajuan.
          </p>
        )}
        {requests.map((r) => (
          <div key={r.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{REQ_TYPE_LABEL[r.type]}</p>
                <p className="text-14 text-muted-foreground">
                  {r.startDate}
                  {r.endDate !== r.startDate ? ` → ${r.endDate}` : ""}
                </p>
              </div>
              <Badge variant={statusBadgeVariant(r.status)}>{REQ_STATUS_LABEL[r.status]}</Badge>
            </div>
            <p className="mt-2 text-14">{r.reason}</p>
            {r.swap && (
              <p className="mt-1 text-13 text-muted-foreground">
                Pengganti: {r.swap.counterpart} ·{" "}
                {r.status === "PENDING"
                  ? r.swap.approved
                    ? "pengganti setuju, menunggu HR"
                    : "menunggu persetujuan pengganti"
                  : ""}
              </p>
            )}
            {r.status === "REJECTED" && r.reviewNote && (
              <p className="mt-1 text-14 text-destructive">Catatan: {r.reviewNote}</p>
            )}
            {r.status === "PENDING" && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                disabled={pending}
                onClick={() => cancel(r.id)}
              >
                Batalkan
              </Button>
            )}
          </div>
        ))}
      </div>

      <AjukanDialog
        open={open}
        onOpenChange={setOpen}
        employees={employees}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function AjukanDialog({
  open,
  onOpenChange,
  onSaved,
  employees,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  employees: Emp[];
}) {
  const [type, setType] = useState<(typeof TYPES)[number]>("LEAVE");
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [jamMasuk, setJamMasuk] = useState("");
  const [jamPulang, setJamPulang] = useState("");
  const [counterpartId, setCounterpart] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const isKoreksi = type === "ATTENDANCE_CORRECTION";
  const isSwap = type === "SHIFT_SWAP";
  const needsCover = !isKoreksi; // cuti/izin/sakit/tukar wajib ada pengganti
  const singleDay = isKoreksi || isSwap;

  function submit() {
    setMsg(null);
    const end = singleDay ? startDate : endDate || startDate;
    let payload: Record<string, unknown> | undefined;
    if (isKoreksi) {
      payload = {};
      if (jamMasuk) payload.checkInAt = `${startDate}T${jamMasuk}:00+07:00`;
      if (jamPulang) payload.checkOutAt = `${startDate}T${jamPulang}:00+07:00`;
    } else if (needsCover) {
      payload = { counterpartId };
    }
    start(async () => {
      const r = await createRequest({ type, startDate, endDate: end, reason, payload });
      if (r.ok) onSaved();
      else setMsg(r.message ?? "Gagal.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajukan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Jenis</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {REQ_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{singleDay ? "Tanggal" : "Mulai"}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} />
            </div>
            {!singleDay && (
              <div className="space-y-2">
                <Label>Selesai</Label>
                <Input type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} />
              </div>
            )}
          </div>
          {needsCover && (
            <div className="space-y-2">
              <Label>{isSwap ? "Pengganti (tukar shift dgn)" : "Pengganti yang menggantikan"}</Label>
              <Select value={counterpartId} onValueChange={setCounterpart}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih karyawan" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isKoreksi && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Jam masuk (opsional)</Label>
                <Input type="time" value={jamMasuk} onChange={(e) => setJamMasuk(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Jam pulang (opsional)</Label>
                <Input type="time" value={jamPulang} onChange={(e) => setJamPulang(e.target.value)} />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Alasan</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {msg && <p className="text-14 text-destructive">{msg}</p>}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={submit} disabled={pending || !startDate || !reason || (needsCover && !counterpartId)}>
            {pending ? "Mengirim…" : "Kirim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
