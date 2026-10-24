import { prisma } from "@/server/db";
import { makeScheduler, type Ctx, type Item, type Task } from "@/lib/media/schedule";

const WIB_MS = 7 * 3600_000;
/** 'YYYY-MM-DD' tanggal hari ini menurut WIB. */
export function todayWIB(): string {
  return new Date(Date.now() + WIB_MS).toISOString().slice(0, 10);
}
/** true bila sudah lewat jam 15.00 WIB (penyeimbang mulai dari besok). */
export function afterThree(): boolean {
  return new Date(Date.now() + WIB_MS).getUTCHours() >= 15;
}
const dateStr = (d: Date | null): string | undefined => (d ? d.toISOString().slice(0, 10) : undefined);

/** Muat semua item+task+settings dari DB ke bentuk yang dipakai mesin penjadwalan. */
export async function loadCtx(): Promise<Ctx> {
  const [items, tasks, settings] = await Promise.all([
    prisma.mediaItem.findMany(),
    prisma.mediaTask.findMany(),
    prisma.mediaSettings.findUnique({ where: { id: 1 } }),
  ]);
  const ctxItems: Item[] = items.map((i) => ({
    id: i.id,
    cat: i.cat,
    tier: i.tier,
    qty: i.qty,
    seasonal: i.seasonal,
    arrived: dateStr(i.arrived),
    old: i.old,
  }));
  const ctxTasks: Task[] = tasks.map((t) => ({
    id: t.id,
    itemId: t.itemId,
    type: t.type,
    status: t.status,
    source: t.source,
    reason: t.reason,
    producer: t.producer,
    editor: t.editor,
    talent: t.talent,
    script: t.script,
    shootPlan: t.shootPlan,
    editPlan: t.editPlan,
    postAt: t.postAt,
    postTime: t.postTime,
    due: t.due,
    target: t.target,
    locked: t.locked,
    checked: t.checked,
    metaAt: t.metaAt ? t.metaAt.getTime() : 0,
    eventKey: t.eventKey,
    cat: t.cat,
    createdAt: t.createdAt.getTime(),
  }));
  return {
    items: ctxItems,
    tasks: ctxTasks,
    settings: {
      idccDay: settings?.idccDay ?? 3,
      jobdesk: (settings?.jobdesk as Ctx["settings"]["jobdesk"]) ?? undefined,
    },
  };
}

/** Jalankan penyeimbang otomatis: pindahkan jadwal yang lewat/penuh, simpan patch ke DB. */
export async function runBalance(): Promise<number> {
  const ctx = await loadCtx();
  const sch = makeScheduler(ctx);
  const changes = sch.computeBalance(todayWIB(), afterThree());
  if (!changes.length) return 0;
  // ponytail: tanpa advisory lock dulu; satu admin buka panel sekaligus jarang. Tambah lock bila bentrok nyata.
  await prisma.$transaction(
    changes.map((c) =>
      prisma.mediaTask.update({
        where: { id: c.t.id },
        data: c.patch as Record<string, unknown>,
      }),
    ),
  );
  return changes.length;
}
