import { requireIg } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { igInsight, igMedia, igProfil } from "@/server/instagram";
import { aturPostIg } from "@/server/actions/instagram";
import { PostIgForm } from "@/components/channel/post-ig-form";

const num = (n: number | null | undefined) => (n == null ? "-" : new Intl.NumberFormat("id-ID").format(n));
const wib = (d: Date | string) => new Date(d).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
const err = (e: unknown) => (e instanceof Error ? e.message : "Gagal.");
const ST: Record<string, string> = { TERJADWAL: "text-sky-600", PROSES: "text-amber-600", TERBIT: "text-emerald-600", GAGAL: "text-destructive" };
const METRIK: [string, string][] = [["reach", "Jangkauan"], ["views", "Tayangan"], ["profile_views", "Kunjungan profil"], ["accounts_engaged", "Akun berinteraksi"], ["total_interactions", "Interaksi"], ["website_clicks", "Klik link"], ["follows_and_unfollows", "Follow bersih"]];

/** Instagram @tirtonic.id: insight 30 hari, posting sekarang / terjadwal, postingan terbaru. */
export default async function InstagramPage() {
  await requireIg();
  const [profil, insight, media, posts] = await Promise.all([
    igProfil().catch((e) => err(e)),
    igInsight().catch(() => null),
    igMedia().catch(() => []),
    prisma.igPost.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {typeof profil === "object" && profil.pic && (
          // eslint-disable-next-line @next/next/no-img-element -- foto profil dari CDN Meta
          <img src={profil.pic} alt="" className="size-14 rounded-full border" />
        )}
        <div>
          <h1 className="text-24 font-semibold">Instagram {typeof profil === "object" ? `@${profil.username}` : ""}</h1>
          {typeof profil === "object" ? (
            <p className="text-14 text-muted-foreground">{num(profil.followers)} pengikut · {num(profil.follows)} mengikuti · {num(profil.posts)} postingan</p>
          ) : (
            <p className="text-14 text-destructive">Instagram belum tersambung: {profil}</p>
          )}
        </div>
      </div>

      {insight && (
        <section>
          <h2 className="mb-2 text-16 font-semibold">30 hari terakhir</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {METRIK.map(([k, l]) => (
              <div key={k} className="rounded-lg border bg-card p-3">
                <p className="text-12 text-muted-foreground">{l}</p>
                <p className="text-20 font-semibold tabular-nums">{num(insight[k])}</p>
              </div>
            ))}
          </div>
          {Object.values(insight).every((v) => v == null) && <p className="mt-1 text-12 text-amber-600">Insight belum bisa diambil: token perlu izin instagram_manage_insights.</p>}
        </section>
      )}

      <section className="space-y-2 rounded-lg border bg-card p-4">
        <h2 className="text-16 font-semibold">Posting baru</h2>
        <PostIgForm />
      </section>

      {posts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-16 font-semibold">Posting dari Tirtonichub</h2>
          <div className="divide-y rounded-lg border bg-card text-14">
            {posts.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className={`w-24 font-medium ${ST[p.status] ?? ""}`}>{p.status === "TERJADWAL" ? "Terjadwal" : p.status === "PROSES" ? "Diproses" : p.status === "TERBIT" ? "Terbit" : "Gagal"}</span>
                <span className="w-20 text-12 text-muted-foreground">{p.tipe === "REELS" ? "Reels" : p.tipe === "CAROUSEL" ? `${(p.keys as string[]).length} foto` : "Foto"}</span>
                <span className="min-w-0 flex-1 truncate">{p.caption || "(tanpa caption)"}</span>
                <span className="text-12 text-muted-foreground">{p.jadwal ? wib(p.jadwal) : wib(p.createdAt)}</span>
                {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" className="text-12 text-primary underline">Lihat</a>}
                {p.error && <span className="w-full text-12 text-destructive">{p.error}</span>}
                {(p.status === "TERJADWAL" || p.status === "GAGAL") && (
                  <form action={aturPostIg} className="flex gap-1">
                    <input type="hidden" name="id" value={p.id} />
                    {p.status === "GAGAL" && <button name="ulang" value="1" className="h-8 rounded-md border px-2 text-12">Coba lagi</button>}
                    <button className="h-8 rounded-md border px-2 text-12 text-destructive">Hapus</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {media.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-16 font-semibold">Postingan terbaru</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {media.map((m) => (
              <a key={m.id} href={m.link} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border bg-card text-12">
                {m.img ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto dari CDN Meta
                  <img src={m.img} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                ) : <span className="block aspect-square bg-muted" />}
                <span className="block p-2 text-muted-foreground">♥ {num(m.likes)} · 💬 {num(m.comments)} · {new Date(m.at).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
