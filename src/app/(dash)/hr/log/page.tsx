import { requireHr } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { ROLE_LABELS } from "@/lib/roles";
import { fmtWIB } from "@/lib/datetime";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function LogPage() {
  await requireHr();
  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { fullName: true } } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-24 font-semibold">Log Aktivitas</h1>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Aktor</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Entitas</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Belum ada aktivitas.
                </TableCell>
              </TableRow>
            )}
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {fmtWIB(l.createdAt)}
                </TableCell>
                <TableCell>
                  {l.actor.fullName}
                  <span className="text-12 text-muted-foreground"> · {ROLE_LABELS[l.actorRole]}</span>
                </TableCell>
                <TableCell>{l.action}</TableCell>
                <TableCell className="text-muted-foreground">
                  {l.entity}
                  {l.entityId ? ` (${l.entityId.slice(0, 8)})` : ""}
                </TableCell>
                <TableCell className="text-muted-foreground">{l.ip ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
