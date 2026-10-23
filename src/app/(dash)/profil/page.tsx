import { requireAuth } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { ROLE_LABELS } from "@/lib/roles";
import { ProfilForm } from "@/components/profil-form";
import { Badge } from "@/components/ui/badge";

export default async function ProfilPage() {
  const ctx = await requireAuth();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    include: { branch: true, roles: { include: { role: true } } },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-24 font-semibold">Profil</h1>

      <section className="rounded-lg bg-card p-5">
        <h2 className="mb-4 font-semibold">Informasi akun</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Info label="Nama lengkap" value={user.fullName} />
          <Info label="Email" value={user.email} />
          <Info label="Nomor WA" value={user.waNumber} />
          <Info label="Cabang" value={user.branch?.name ?? "—"} />
        </dl>
        <div className="mt-4 flex flex-wrap gap-1">
          {user.roles.map((r) => (
            <Badge key={r.role.code} variant="secondary">
              {ROLE_LABELS[r.role.code]}
            </Badge>
          ))}
        </div>
        <p className="mt-3 text-12 text-muted-foreground">
          Nama, email, WA, role, dan cabang hanya bisa diubah oleh HR/Boss.
        </p>
      </section>

      <ProfilForm
        nickname={user.nickname ?? ""}
        bio={user.bio ?? ""}
        themePref={user.themePref as "light" | "dark" | "system"}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-12 text-muted-foreground">{label}</dt>
      <dd className="text-14">{value}</dd>
    </div>
  );
}
