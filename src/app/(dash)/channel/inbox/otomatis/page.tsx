import Link from "next/link";
import { requireChannel } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { aturAuto, hapusTemplate, simpanAuto, simpanTemplate } from "@/server/actions/inbox";

const field = "w-full rounded-md border bg-background px-3 py-2 text-14";
const btn = "h-9 rounded-md border px-3 text-14 font-medium hover:bg-muted";

/** Inbox → Template balasan cepat & Auto DM komentar Instagram. */
export default async function InboxOtomatisPage() {
  await requireChannel();
  const [templates, autos] = await Promise.all([prisma.inboxTemplate.findMany({ orderBy: { judul: "asc" } }), prisma.inboxAuto.findMany({ orderBy: { createdAt: "asc" } })]);
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/channel/inbox" className="text-14 text-muted-foreground">← Inbox</Link>
        <h1 className="text-24 font-semibold">Template & Auto DM</h1>
      </div>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <div>
          <h2 className="text-16 font-semibold">Template balasan</h2>
          <p className="text-12 text-muted-foreground">Muncul di kolom balas Inbox (pilih &quot;Template balasan…&quot;), bisa diedit sebelum dikirim. Berlaku untuk WA, IG, Messenger.</p>
        </div>
        {templates.map((t) => (
          <form key={t.id} action={hapusTemplate} className="flex items-start gap-2 border-t pt-2 text-14">
            <input type="hidden" name="id" value={t.id} />
            <div className="min-w-0 flex-1"><b>{t.judul}</b><p className="whitespace-pre-wrap text-muted-foreground">{t.teks}</p></div>
            <button className={`${btn} text-destructive`}>Hapus</button>
          </form>
        ))}
        <form action={simpanTemplate} className="space-y-2 border-t pt-3">
          <input name="judul" required placeholder="Judul, mis. Alamat toko" className={field} />
          <textarea name="teks" required rows={3} placeholder="Isi balasan" className={field} />
          <button className={btn}>Tambah template</button>
        </form>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <div>
          <h2 className="text-16 font-semibold">Auto DM komentar Instagram</h2>
          <p className="text-12 text-muted-foreground">Kalau komentar di postingan @tirtonic.id berisi salah satu keyword, pengomentar otomatis dikirimi DM (sekali per komentar). Pisahkan beberapa keyword dengan koma, mis. <i>harga, price, berapa</i>.</p>
        </div>
        {autos.map((a) => (
          <div key={a.id} className="flex items-start gap-2 border-t pt-2 text-14">
            <div className="min-w-0 flex-1">
              <b>{a.keyword}</b> {!a.aktif && <span className="text-12 text-muted-foreground">(mati)</span>}
              <p className="whitespace-pre-wrap text-muted-foreground">{a.balasan}</p>
            </div>
            <form action={aturAuto}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="aktif" value={a.aktif ? "0" : "1"} />
              <button className={btn}>{a.aktif ? "Matikan" : "Nyalakan"}</button>
            </form>
            <form action={aturAuto}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="hapus" value="1" />
              <button className={`${btn} text-destructive`}>Hapus</button>
            </form>
          </div>
        ))}
        <form action={simpanAuto} className="space-y-2 border-t pt-3">
          <input name="keyword" required placeholder="Keyword, mis. harga, price, berapa" className={field} />
          <textarea name="balasan" required rows={3} placeholder="Isi DM otomatis, mis. Halo kak! Harga & stok sudah kami kirim ya, cek DM 🙏" className={field} />
          <button className={btn}>Tambah Auto DM</button>
        </form>
      </section>
    </div>
  );
}
