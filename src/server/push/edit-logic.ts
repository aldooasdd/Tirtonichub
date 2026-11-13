// WA + lonceng ke PIC Editing (permintaan Zaki, 13 Nov 2026), khusus Foto Instagram, Video produk, Video review.
// - "start": kartu dipindah dari Terdata ke Diproduksi/Editing, atau editor diganti saat Diproduksi/Editing.
// - "deadline": Deadline Ready diisi/diubah saat kartu sudah Diproduksi/Editing (selama masih Terdata tidak dikirim).
// Tidak dikirim bila yang memindah/mengubah adalah editor itu sendiri.
// Jeda 15 menit (14 Nov 2026): pesan ditahan di tasks.editNotif dan baru dikirim 15 menit setelah perubahan TERAKHIR
// pada kartu itu (setiap edit menghitung ulang jedanya), supaya WA tidak terkirim berulang saat Zaki masih mengatur kartu.
// Isi pesan memakai keadaan kartu saat dikirim (editor & deadline terbaru).

export const EDIT_NOTIF_TYPES = ["igf", "vpr", "vrv"];
const TYPE_LABEL: Record<string, string> = { igf: "Foto Instagram", vpr: "Video produk", vrv: "Video review" };
const WORK = ["Diproduksi", "Editing"];
type Doc = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
export const deadlineOf = (d: Doc | null | undefined) => (d ? s(d.readyBy) || s(d.due) : "");

export const EDIT_DELAY_MS = 15 * 60_000;
export type EditPending = { kind: "start" | "deadline"; due: number; by: string };
export function pendingOf(v: unknown): EditPending | null {
  if (!v || typeof v !== "object") return null;
  const p = v as EditPending;
  return (p.kind === "start" || p.kind === "deadline") && typeof p.due === "number" ? p : null;
}
/** Antrean baru setelah satu perubahan kartu. undefined = tidak ada yang ditahan. */
export function nextEditPending(prev: unknown, before: Doc | null, after: Doc, by: string, actorCode = "", now = Date.now()): EditPending | undefined {
  const p = pendingOf(prev);
  const kind = editNotifKind(before, after, actorCode);
  if (kind) return { kind: p?.kind === "start" ? "start" : kind, due: now + EDIT_DELAY_MS, by: by || p?.by || "" };
  if (p) return { ...p, due: now + EDIT_DELAY_MS, by: by || p.by }; // masih diedit → jeda dihitung ulang
  return undefined;
}
/** Saat jeda habis: kirim hanya bila kartu masih Foto IG/Video produk/Video review di Diproduksi/Editing dan punya editor. */
export function stillSendable(t: Doc): boolean {
  return EDIT_NOTIF_TYPES.includes(s(t.type)) && WORK.includes(s(t.status)) && !!s(t.editor) && !t.mergedInto && !t.suspendedAt;
}

export function editNotifKind(before: Doc | null, after: Doc, actorCode = ""): "start" | "deadline" | null {
  const t = s(after.type), ed = s(after.editor), st = s(after.status);
  if (!EDIT_NOTIF_TYPES.includes(t) || !ed || ed === actorCode || !WORK.includes(st)) return null;
  const was = s(before?.status);
  if (was === "Terdata" || was === "Rencana") return "start";
  if (!WORK.includes(was)) return null;
  if (s(before?.editor) !== ed) return "start";
  const dl = deadlineOf(after);
  if (dl && dl !== deadlineOf(before)) return "deadline";
  return null;
}

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export function tglID(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  const x = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${HARI[x.getUTCDay()]}, ${+m[3]} ${BULAN[+m[2] - 1]} ${m[1]}`;
}

export function editNotifMsg(kind: "start" | "deadline", after: Doc, by: string) {
  const label = TYPE_LABEL[s(after.type)] ?? s(after.type);
  const title = s(after.title) || "Konten";
  const dl = deadlineOf(after);
  const dlTxt = `Deadline Ready: ${dl ? tglID(dl) : "belum ditetapkan"}`;
  if (kind === "start")
    return {
      type: "studio_edit",
      title: `✂️ Siap Anda edit: ${title}`,
      body: `*${label}* sudah masuk produksi. Anda PIC editing.\n${dlTxt}` + (by ? `\nDipindah oleh ${by}.` : ""),
      url: "/studio/?p=pipeline",
    };
  return {
    type: "studio_edit",
    title: `⏰ Deadline Ready: ${title}`,
    body: `*${label}* yang Anda edit.\n${dlTxt}` + (by ? `\nDitetapkan oleh ${by}.` : ""),
    url: "/studio/?p=pipeline",
  };
}
