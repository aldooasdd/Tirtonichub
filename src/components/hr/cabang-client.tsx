"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createBranch, updateBranch, deleteBranch } from "@/server/actions/branches";
import { setBranchPosPassword } from "@/server/actions/pos";

type Row = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  userCount: number;
  posSet?: boolean;
};

export function CabangClient({ branches }: { branches: Row[] }) {
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();

  function remove(row: Row) {
    if (!confirm(`Hapus cabang "${row.name}"?`)) return;
    start(async () => {
      const r = await deleteBranch(row.id);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-24 font-semibold">Cabang</h1>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      {/* HP: list kartu */}
      <div className="flex flex-col gap-3 md:hidden">
        {branches.length === 0 && (
          <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">
            Belum ada cabang.
          </p>
        )}
        {branches.map((b) => (
          <div key={b.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{b.name}</p>
                <p className="truncate text-14 text-muted-foreground">{b.address ?? "—"}</p>
                <p className="text-12 text-muted-foreground">Kasir /pos: {b.posSet ? "password diatur" : "belum ada password"}</p>
              </div>
              <span className="text-14 text-muted-foreground">{b.userCount} org</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setEditing(b);
                  setOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => remove(b)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: tabel */}
      <div className="hidden rounded-lg border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Alamat</TableHead>
              <TableHead className="text-right">Karyawan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Belum ada cabang.
                </TableCell>
              </TableRow>
            )}
            {branches.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">
                  {b.name}
                  <p className="text-12 font-normal text-muted-foreground">Kasir /pos: {b.posSet ? "password diatur" : "belum ada password"}</p>
                </TableCell>
                <TableCell className="text-muted-foreground">{b.address ?? "—"}</TableCell>
                <TableCell className="text-right">{b.userCount}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(b);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending}
                      onClick={() => remove(b)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CabangDialog
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

function CabangDialog({
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
  const [address, setAddress] = useState(editing?.address ?? "");
  const [lat, setLat] = useState(editing?.latitude?.toString() ?? "");
  const [lng, setLng] = useState(editing?.longitude?.toString() ?? "");
  const [posPw, setPosPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setMsg(null);
    start(async () => {
      const input = {
        name,
        address: address || null,
        latitude: lat ? Number(lat) : null,
        longitude: lng ? Number(lng) : null,
      };
      const r = editing ? await updateBranch(editing.id, input) : await createBranch(input);
      if (!r.ok) return setMsg(r.message ?? "Gagal.");
      const id = editing?.id ?? r.id;
      if (posPw.trim() && id) {
        const p = await setBranchPosPassword(id, posPw);
        if (!p.ok) return setMsg(p.message ?? "Gagal simpan password kasir.");
      }
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Cabang" : "Tambah Cabang"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nama</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Alamat</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Latitude</Label>
              <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-7.79" />
            </div>
            <div className="space-y-2">
              <Label>Longitude</Label>
              <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="110.36" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Password kasir /pos</Label>
            <Input
              type="text"
              autoComplete="off"
              value={posPw}
              onChange={(e) => setPosPw(e.target.value)}
              placeholder={editing?.posSet ? "Kosongkan = tidak diganti" : "Min. 6 karakter, beda tiap cabang"}
            />
            <p className="text-12 text-muted-foreground">Ganti password = semua mesin kasir cabang ini keluar.</p>
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
