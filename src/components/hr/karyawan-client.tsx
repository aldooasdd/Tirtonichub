"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_CODES, ROLE_LABELS, type RoleCode } from "@/lib/roles";
import { createEmployee, updateEmployee, setEmployeeActive } from "@/server/actions/employees";

type Row = {
  id: string;
  fullName: string;
  email: string;
  waNumber: string;
  branchId: string | null;
  branchName: string | null;
  joinedAt: string | null;
  isActive: boolean;
  roleCodes: RoleCode[];
};

type Ref = { id: string; name: string };

export function KaryawanClient({
  users,
  branches,
  schedules,
  canAssignBossHr,
  selfId,
}: {
  users: Row[];
  branches: Ref[];
  schedules: Ref[];
  canAssignBossHr: boolean;
  selfId: string;
}) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();

  const filtered = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(q.toLowerCase()) ||
      u.email.toLowerCase().includes(q.toLowerCase()),
  );

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(row: Row) {
    setEditing(row);
    setOpen(true);
  }
  function toggleActive(row: Row) {
    start(async () => {
      const r = await setEmployeeActive(row.id, !row.isActive);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-24 font-semibold">Karyawan</h1>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      <Input
        placeholder="Cari nama / email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-xs"
      />

      {/* HP: list kartu (PRD §7.1) */}
      <div className="flex flex-col gap-3 md:hidden">
        {filtered.length === 0 && (
          <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">
            Tidak ada karyawan.
          </p>
        )}
        {filtered.map((u) => (
          <div key={u.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/hr/karyawan/${u.id}`} className="truncate font-medium hover:underline">
                  {u.fullName}
                </Link>
                <p className="truncate text-14 text-muted-foreground">{u.email}</p>
                <p className="truncate text-14 text-muted-foreground">{u.waNumber}</p>
              </div>
              <Badge variant={u.isActive ? "default" : "outline"}>
                {u.isActive ? "Aktif" : "Nonaktif"}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {u.roleCodes.map((c) => (
                <Badge key={c} variant="secondary">
                  {ROLE_LABELS[c]}
                </Badge>
              ))}
            </div>
            <p className="mt-2 text-14 text-muted-foreground">Cabang: {u.branchName ?? "—"}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEdit(u)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={pending}
                onClick={() => toggleActive(u)}
              >
                {u.isActive ? "Nonaktifkan" : "Aktifkan"}
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
              <TableHead>Email</TableHead>
              <TableHead>WA</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Cabang</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Tidak ada karyawan.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  <Link href={`/hr/karyawan/${u.id}`} className="hover:underline">
                    {u.fullName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell className="text-muted-foreground">{u.waNumber}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.roleCodes.map((c) => (
                      <Badge key={c} variant="secondary">
                        {ROLE_LABELS[c]}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.branchName ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={u.isActive ? "default" : "outline"}>
                    {u.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => toggleActive(u)}
                    >
                      {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EmployeeDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        branches={branches}
        schedules={schedules}
        canAssignBossHr={canAssignBossHr}
        selfId={selfId}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function EmployeeDialog({
  open,
  onOpenChange,
  editing,
  branches,
  schedules,
  canAssignBossHr,
  selfId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Row | null;
  branches: Ref[];
  schedules: Ref[];
  canAssignBossHr: boolean;
  selfId: string;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(editing?.fullName ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [waNumber, setWa] = useState(editing?.waNumber ?? "+62");
  const [branchId, setBranchId] = useState(editing?.branchId ?? "");
  const [joinedAt, setJoinedAt] = useState(editing?.joinedAt ?? "");
  const [roleCodes, setRoleCodes] = useState<RoleCode[]>(editing?.roleCodes ?? []);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const isSelf = editing?.id === selfId;
  const roleLocked = (code: RoleCode) =>
    (!canAssignBossHr && (code === "BOSS" || code === "HR")) || (isSelf && !canAssignBossHr);

  function toggleRole(code: RoleCode) {
    setRoleCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function submit() {
    setMsg(null);
    start(async () => {
      const input = {
        fullName,
        email,
        waNumber,
        branchId: branchId || null,
        joinedAt: joinedAt || null,
        roleCodes,
      };
      const r = editing
        ? await updateEmployee(editing.id, input)
        : await createEmployee(input);
      if (r.ok) onSaved();
      else setMsg(r.message ?? "Gagal.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Karyawan" : "Tambah Karyawan"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Nama lengkap">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Nomor WA (+62…)">
            <Input value={waNumber} onChange={(e) => setWa(e.target.value)} />
          </Field>
          <Field label="Cabang">
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih cabang" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tanggal mulai kerja">
            <Input type="date" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} />
          </Field>
          <div className="space-y-2">
            <Label>Role</Label>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_CODES.map((code) => (
                <label
                  key={code}
                  className="flex items-center gap-2 text-14 data-[locked=true]:opacity-50"
                  data-locked={roleLocked(code)}
                >
                  <Checkbox
                    checked={roleCodes.includes(code)}
                    disabled={roleLocked(code)}
                    onCheckedChange={() => toggleRole(code)}
                  />
                  {ROLE_LABELS[code]}
                </label>
              ))}
            </div>
            {isSelf && !canAssignBossHr && (
              <p className="text-12 text-muted-foreground">
                Kamu tidak bisa mengubah role akun sendiri.
              </p>
            )}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
