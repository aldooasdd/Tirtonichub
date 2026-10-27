import type { Prisma } from "@/generated/prisma";
import { requireStock } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { Input } from "@/components/ui/input";
import { fileUrl } from "@/server/storage";

const rupiah = new Intl.NumberFormat("id-ID");
const tgl = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });

export default async function StokPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireStock();
  const q = (await searchParams).q?.trim() ?? "";
  const like: Prisma.StringFilter = { contains: q, mode: "insensitive" };
  const rows = await prisma.rawProduct.findMany({
    where: {
      status: "STOCK",
      ...(q
        ? { OR: [{ name: like }, { sku: like }, { brand: like }, { color: like }, { supplier: like }] }
        : {}),
    },
    orderBy: { qcAt: "desc" },
    include: { qcBy: { select: { fullName: true } } },
  });
  const photos = await Promise.all(rows.map((r) => (r.qcPhotoKey ? fileUrl(r.qcPhotoKey) : Promise.resolve(null))));

  return (
    <div className="space-y-4">
      <h1 className="text-24 font-semibold">Stok</h1>
      <form className="max-w-sm">
        <Input name="q" defaultValue={q} placeholder="Cari nama / SKU / merek / supplier…" />
      </form>

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card py-12 text-center text-muted-foreground">Belum ada stok.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r, i) => {
            const chips = [r.brand, r.color, r.size].filter(Boolean) as string[];
            return (
              <div key={r.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="relative h-40 w-full bg-gradient-to-br from-sky-200 via-violet-200 to-fuchsia-200">
                  {photos[i] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photos[i]!} alt={r.name} className="h-full w-full object-cover" />
                  )}
                  {chips.length > 0 && (
                    <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                      {chips.map((c) => (
                        <span key={c} className="rounded-md bg-background/85 px-2 py-0.5 text-12 font-medium text-foreground backdrop-blur">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <h3 className="text-16 font-semibold leading-tight">{r.name}</h3>
                  <p className="text-13 text-muted-foreground">
                    {[r.sku ? `SKU ${r.sku}` : null, r.supplier].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <hr className="border-border" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-13 font-medium">{r.qcBy?.fullName ?? "—"}</p>
                      <p className="text-11 text-muted-foreground">{r.qcAt ? tgl.format(r.qcAt) : "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-15 font-semibold">{r.sellPrice != null ? `Rp ${rupiah.format(r.sellPrice)}` : "—"}</p>
                      <p className="text-11 text-muted-foreground">{r.qty} {r.unit ?? "pcs"}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
