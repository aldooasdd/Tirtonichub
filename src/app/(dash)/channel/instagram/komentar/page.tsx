import Link from "next/link";
import { requireChannel } from "@/server/auth/rbac";
import { igKomentar, igMedia, igPost1, type IgKomentar, type IgMedia } from "@/server/instagram";
import { BalasKomentar } from "@/components/channel/balas-komentar";

const wib = (d: string) => new Date(d).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
const err = (e: unknown) => (e instanceof Error ? e.message : "Gagal.");

/** Komentar IG: pilih postingan @tirtonic.id → semua komentarnya, balas publik / DM / sembunyikan. Data langsung dari Instagram. */
export default async function KomentarIgPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireChannel();
  const { m } = await searchParams;
  let posts: IgMedia[] = [];
  let gagal = "";
  try {
    posts = (await igMedia(100)).filter((p) => p.comments > 0 || p.id === m); // hanya postingan yang ada komentarnya
  } catch (e) {
    gagal = err(e);
  }
  const pilih = m ?? posts[0]?.id;
  let post: IgMedia | null = posts.find((p) => p.id === pilih) ?? null;
  let kom: IgKomentar[] = [];
  let gagalKom = "";
  if (pilih) {
    try {
      [post, kom] = await Promise.all([post ? Promise.resolve(post) : igPost1(pilih), igKomentar(pilih)]);
    } catch (e) {
      gagalKom = err(e);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-24 font-semibold">Komentar IG</h1>
        <p className="text-14 text-muted-foreground">Postingan yang ada komentarnya (100 postingan terakhir). Pilih postingan, lalu balas komentarnya: publik di postingan atau lewat DM.</p>
      </div>
      {gagal && <p className="rounded-md bg-destructive/10 p-3 text-14 text-destructive">Instagram belum bisa dibaca: {gagal}</p>}
      <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
        <div className="grid max-h-[calc(100dvh-12rem)] grid-cols-3 content-start gap-1.5 overflow-y-auto rounded-lg border bg-card p-1.5">
          {!gagal && posts.length === 0 && <p className="col-span-3 p-4 text-center text-14 text-muted-foreground">Belum ada komentar di 100 postingan terakhir.</p>}
          {posts.map((p) => (
            <Link key={p.id} href={`/channel/instagram/komentar?m=${p.id}`} className={`relative block overflow-hidden rounded-md border-2 ${p.id === pilih ? "border-primary" : "border-transparent"}`}>
              {p.img ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto dari CDN Meta
                <img src={p.img} alt="" loading="lazy" className="aspect-square w-full object-cover" />
              ) : <span className="block aspect-square bg-muted" />}
              <span className={`absolute right-1 bottom-1 rounded px-1.5 text-12 font-medium ${p.comments ? "bg-primary text-primary-foreground" : "bg-black/50 text-white"}`}>💬 {p.comments}</span>
            </Link>
          ))}
        </div>

        <div className="min-w-0 space-y-3">
          {post && (
            <div className="flex gap-3 rounded-lg border bg-card p-3">
              {post.img && (
                // eslint-disable-next-line @next/next/no-img-element -- foto dari CDN Meta
                <img src={post.img} alt="" className="size-24 shrink-0 rounded-md object-cover" />
              )}
              <div className="min-w-0 text-14">
                <p className="line-clamp-4 whitespace-pre-wrap">{post.caption || "(tanpa caption)"}</p>
                <p className="mt-1 text-12 text-muted-foreground">♥ {post.likes} · 💬 {post.comments} · {wib(post.at)} · <a href={post.link} target="_blank" rel="noreferrer" className="text-primary underline">Buka di Instagram</a></p>
              </div>
            </div>
          )}
          {gagalKom && <p className="rounded-md bg-destructive/10 p-3 text-14 text-destructive">Komentar belum bisa dibaca: {gagalKom}. Token perlu izin instagram_manage_comments.</p>}
          {post && !gagalKom && kom.length === 0 && <p className="rounded-lg border bg-card p-6 text-center text-14 text-muted-foreground">Belum ada komentar.</p>}
          {kom.map((c) => (
            <div key={c.id} className={`space-y-2 rounded-lg border bg-card p-3 text-14 ${c.hidden ? "opacity-60" : ""}`}>
              <p><b>@{c.user}</b> {c.text}</p>
              <p className="text-12 text-muted-foreground">{wib(c.at)}{c.likes ? ` · ♥ ${c.likes}` : ""}{c.hidden ? " · disembunyikan" : ""}</p>
              {c.replies.map((r) => (
                <p key={r.id} className="ml-5 border-l-2 pl-3"><b>@{r.user}</b> {r.text} <span className="text-12 text-muted-foreground">· {wib(r.at)}</span></p>
              ))}
              <BalasKomentar id={c.id} user={c.user} hidden={c.hidden} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
