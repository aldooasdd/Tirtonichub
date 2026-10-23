"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABELS, type RoleCode } from "@/lib/roles";
import { revokeUserSession } from "@/server/actions/sessions";

type Row = {
  id: string;
  userName: string;
  email: string;
  activeRole: RoleCode | null;
  userAgent: string | null;
  ip: string | null;
  lastActive: string;
};

export function SesiClient({ sessions }: { sessions: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function revoke(id: string) {
    if (!confirm("Cabut sesi ini?")) return;
    start(async () => {
      const r = await revokeUserSession(id);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-24 font-semibold">Sesi Aktif</h1>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pengguna</TableHead>
              <TableHead>Role aktif</TableHead>
              <TableHead>Perangkat</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Terakhir aktif</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Tidak ada sesi aktif.
                </TableCell>
              </TableRow>
            )}
            {sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="font-medium">{s.userName}</div>
                  <div className="text-12 text-muted-foreground">{s.email}</div>
                </TableCell>
                <TableCell>{s.activeRole ? ROLE_LABELS[s.activeRole] : "—"}</TableCell>
                <TableCell className="max-w-48 truncate text-muted-foreground">
                  {s.userAgent ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{s.ip ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {s.lastActive}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => revoke(s.id)}>
                    Cabut
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
