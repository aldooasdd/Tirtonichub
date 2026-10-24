import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireHr } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { ROLE_LABELS } from "@/lib/roles";
import { fmtWIB } from "@/lib/datetime";
import { REQ_TYPE_LABEL, REQ_STATUS_LABEL, statusBadgeVariant } from "@/lib/request-labels";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SesiClient } from "@/components/hr/sesi-client";

const ATT_STATUS: Record<string, string> = {
  ON_TIME: "Tepat waktu",
  LATE: "Terlambat",
  ABSENT: "Tidak hadir",
  LEAVE: "Cuti",
  SICK: "Sakit",
  PERMIT: "Izin",
  HOLIDAY: "Libur",
};

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(d);
}

export default async function KaryawanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireHr();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      roles: { include: { role: true } },
      branch: true,
      schedules: { include: { schedule: true }, orderBy: { effectiveFrom: "desc" }, take: 1 },
    },
  });
  if (!user) notFound();

  const [attendances, requests, sessions, logs] = await Promise.all([
    prisma.attendance.findMany({ where: { userId: id }, orderBy: { date: "desc" }, take: 31 }),
    prisma.request.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      include: { reviewedBy: { select: { fullName: true } } },
    }),
    prisma.session.findMany({
      where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: "desc" },
    }),
    prisma.activityLog.findMany({
      where: { OR: [{ actorId: id }, { entity: "User", entityId: id }] },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const schedule = user.schedules[0]?.schedule ?? null;

  return (
    <div className="space-y-4">
      <Link
        href="/hr/karyawan"
        className="inline-flex items-center gap-1 text-14 text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Karyawan
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-24 font-semibold">{user.fullName}</h1>
        <Badge variant={user.isActive ? "default" : "outline"}>
          {user.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="flex-wrap">
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="role">Role</TabsTrigger>
          <TabsTrigger value="absen">Riwayat Absen</TabsTrigger>
          <TabsTrigger value="pengajuan">Pengajuan</TabsTrigger>
          <TabsTrigger value="sesi">Sesi Aktif</TabsTrigger>
          <TabsTrigger value="log">Log</TabsTrigger>
        </TabsList>

        {/* Info */}
        <TabsContent value="info">
          <dl className="grid gap-3 rounded-lg border bg-card p-4 text-14 sm:grid-cols-2">
            <Field label="Nama lengkap" value={user.fullName} />
            <Field label="Email" value={user.email} />
            <Field label="Nomor WA" value={user.waNumber} />
            <Field label="Cabang" value={user.branch?.name ?? "—"} />
            <Field
              label="Jadwal kerja"
              value={schedule ? `${schedule.name} (${schedule.startTime}–${schedule.endTime})` : "—"}
            />
            <Field
              label="Mulai kerja"
              value={user.joinedAt ? fmtDate(user.joinedAt) : "—"}
            />
          </dl>
        </TabsContent>

        {/* Role */}
        <TabsContent value="role">
          <div className="rounded-lg border bg-card p-4">
            {user.roles.length === 0 ? (
              <p className="text-muted-foreground">Belum ada role.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {user.roles.map((r) => (
                  <Badge key={r.role.code} variant="secondary">
                    {ROLE_LABELS[r.role.code]}
                  </Badge>
                ))}
              </div>
            )}
            <p className="mt-3 text-12 text-muted-foreground">
              Ubah role lewat tombol Edit di daftar Karyawan.
            </p>
          </div>
        </TabsContent>

        {/* Riwayat Absen */}
        <TabsContent value="absen">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Masuk</TableHead>
                  <TableHead>Pulang</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendances.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      Belum ada absen.
                    </TableCell>
                  </TableRow>
                )}
                {attendances.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{fmtDate(a.date)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.checkInAt ? fmtWIB(a.checkInAt) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.checkOutAt ? fmtWIB(a.checkOutAt) : "—"}
                    </TableCell>
                    <TableCell>
                      {ATT_STATUS[a.status]}
                      {a.status === "LATE" ? ` ${a.lateMinutes}m` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Pengajuan */}
        <TabsContent value="pengajuan">
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
                      {fmtDate(r.startDate)}
                      {r.endDate.getTime() !== r.startDate.getTime() ? ` → ${fmtDate(r.endDate)}` : ""}
                    </p>
                  </div>
                  <Badge variant={statusBadgeVariant(r.status)}>{REQ_STATUS_LABEL[r.status]}</Badge>
                </div>
                <p className="mt-2 text-14">{r.reason}</p>
                {r.reviewNote && (
                  <p className="mt-2 text-12 text-muted-foreground">
                    Catatan: {r.reviewNote}
                    {r.reviewedBy ? ` — ${r.reviewedBy.fullName}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Sesi Aktif */}
        <TabsContent value="sesi">
          <SesiClient
            sessions={sessions.map((s) => ({
              id: s.id,
              userName: user.fullName,
              email: user.email,
              activeRole: s.activeRoleCode,
              userAgent: s.userAgent,
              ip: s.ip,
              lastActive: fmtWIB(s.lastActiveAt),
            }))}
          />
        </TabsContent>

        {/* Log */}
        <TabsContent value="log">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead>Entitas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      Belum ada aktivitas.
                    </TableCell>
                  </TableRow>
                )}
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {fmtWIB(l.createdAt)}
                    </TableCell>
                    <TableCell>{l.action}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.entity}
                      {l.entityId ? ` (${l.entityId.slice(0, 8)})` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-12 text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
