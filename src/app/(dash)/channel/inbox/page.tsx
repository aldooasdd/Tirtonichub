import Link from "next/link";
import { requireChannel } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { userNames } from "@/server/user-names";
import { Inbox, type Chat } from "@/components/channel/inbox";
import { gowaAkun } from "@/server/gowa-inbox";
import { isiNamaIg } from "@/server/meta-inbox";

const dalam24Jam = (d: Date) => Date.now() - d.getTime() < 24 * 3600_000; // jendela balas Meta

/** Inbox WA + IG: chat pelanggan dari Meta, dibalas dari Tirtonichub. Nama nomor admin: env META_LABELS="phone_number_id=Admin 1,…". */
export default async function InboxPage({ searchParams }: { searchParams: Promise<{ t?: string; q?: string }> }) {
  await requireChannel();
  const { t, q } = await searchParams;
  const labels = new Map([
    ...(process.env.META_LABELS ?? "").split(",").map((x) => x.split("=").map((s) => s.trim()) as [string, string]).filter((x) => x[0] && x[1]),
    ...(await prisma.waNumber.findMany({ select: { phoneNumberId: true, label: true } })).map((n) => [n.phoneNumberId, n.label] as [string, string]),
    ...gowaAkun().map((a) => [`gowa:${a.n}`, a.label] as [string, string]),
  ]);
  await isiNamaIg(); // chat IG lama yang belum punya nama
  const s = (q ?? "").trim();
  const threads = await prisma.inboxThread.findMany({
    where: s ? { channel: { not: "IGK" }, OR: [{ name: { contains: s, mode: "insensitive" } }, { contactId: { contains: s } }, { lastText: { contains: s, mode: "insensitive" } }] } : { channel: { not: "IGK" } }, // komentar IG punya menu sendiri (Komentar IG)
    orderBy: { lastAt: "desc" },
    take: 200,
  });
  const aktif = t ? await prisma.inboxThread.findUnique({ where: { id: t } }) : null;
  const msgs = aktif ? (await prisma.inboxMessage.findMany({ where: { threadId: aktif.id }, orderBy: { at: "desc" }, take: 300 })).reverse() : [];
  const lastIn = aktif ? await prisma.inboxMessage.findFirst({ where: { threadId: aktif.id, dir: "in" }, orderBy: { at: "desc" }, select: { at: true } }) : null;
  const [names, templates] = await Promise.all([userNames(msgs.map((m) => m.userId)), prisma.inboxTemplate.findMany({ orderBy: { judul: "asc" }, select: { id: true, judul: true, teks: true } })]);
  const VIA: Record<string, string> = { IG: "Instagram", IGK: "Komentar IG", FB: "Messenger" };
  const label = (x: { channel: string; accountId: string }) => VIA[x.channel] ?? `WA ${labels.get(x.accountId) ?? ""}`.trim();
  const chat = (x: (typeof threads)[number]): Chat => ({ id: x.id, name: x.name || (x.channel === "WA" ? `+${x.contactId}` : `IG ${x.contactId.slice(-6)}`), via: label(x), channel: x.channel, lastText: x.lastText ?? "", lastAt: x.lastAt.toISOString(), unread: x.unread });

  return (
    <div className="space-y-3">
      <div>
        <h1 className="flex flex-wrap items-center justify-between gap-2 text-24 font-semibold">
          Inbox
          <Link href="/channel/inbox/otomatis" className="rounded-md border px-3 py-1.5 text-14 font-medium">Template & Auto DM</Link>
        </h1>
        <p className="text-14 text-muted-foreground">Chat WhatsApp & Instagram pelanggan. Balasan dari HP juga ikut muncul di sini. Instagram: balas maksimal 24 jam sejak pesan terakhir pelanggan.</p>
      </div>
      <Inbox
        threads={threads.map(chat)}
        aktif={aktif ? chat(aktif) : null}
        q={s}
        buka={!!aktif?.accountId.startsWith("gowa:") || aktif?.channel === "IGK" || (!!lastIn && dalam24Jam(lastIn.at))}
        msgs={msgs.map((m) => ({ id: m.id, dir: m.dir, text: m.text, at: m.at.toISOString(), by: m.userId ? names(m.userId) : m.dir === "out" ? (m.text.startsWith("[Auto DM]") ? "Otomatis" : "HP") : null, error: m.error, mediaUrl: m.mediaUrl }))}
        templates={templates}
      />
    </div>
  );
}
