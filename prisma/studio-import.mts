// Pindah data dari ekspor Firebase (repo tirtonic-studio: tools/export-firebase.py) ke database Tirtonichub.
// Aman dijalankan berulang (upsert per dokumen, id sama seperti di Firebase). Coba dulu dengan --dry-run.
//
//   node --env-file=.env --import tsx prisma/studio-import.mts <ekspor.json> <peta-email.json> [--dry-run] [--admin <email-admin-hub>]
//
// peta-email.json: { "email-gmail-lama": "email@tirtonichub.com", ... } — akun Tirtonichub tujuan HARUS sudah ada.
// Anggota tanpa pasangan di peta dilewati (kalender pribadinya juga).
import { readFileSync } from "node:fs";
import { prisma } from "@/server/db";
import { writeDoc } from "@/server/studio/store";
import type { Doc, StudioUser } from "@/server/studio/rules";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const verbose = args.includes("--verbose");
const adminArg = args.includes("--admin") ? args[args.indexOf("--admin") + 1] : "";
const [exportFile, mapFile] = args.filter((a) => !a.startsWith("--") && a !== adminArg);
if (!exportFile || !mapFile) throw new Error("Pakai: studio-import.mts <ekspor.json> <peta-email.json> [--dry-run] [--admin email]");
const { docs } = JSON.parse(readFileSync(exportFile, "utf8")) as { docs: Record<string, Doc> };
const peta: Record<string, string> = Object.fromEntries(Object.entries(JSON.parse(readFileSync(mapFile, "utf8")) as Record<string, string>).map(([a, b]) => [a.toLowerCase(), b.toLowerCase()]));

// Akun tujuan harus ada
const users = new Map<string, string>();
for (const email of new Set(Object.values(peta))) {
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (u) users.set(email, u.id);
}
const missing = [...new Set(Object.values(peta))].filter((e) => !users.has(e));
const adminEmail = (adminArg || Object.values(peta)[0] || "").toLowerCase();
const adminId = users.get(adminEmail);
if (!adminId) throw new Error("Akun admin tujuan tidak ditemukan: " + adminEmail);
const system: StudioUser = { userId: adminId, email: adminEmail, name: "Impor", code: "", full: true, staff: true, idcc: true };

// Alamat lama → alamat baru (email anggota diganti sesuai peta)
const plan: { from: string; to: string; doc: Doc }[] = [];
const skip: string[] = [];
for (const [path, doc] of Object.entries(docs)) {
  const p = path.split("/");
  if (p[0] === "locks") continue; // kunci sementara, tidak perlu
  if (p[0] === "members" || p[0] === "pcal") {
    const to = peta[decodeURIComponent(p[1]).toLowerCase()];
    if (!to || !users.has(to)) { skip.push(path); continue; }
    p[1] = to;
  }
  plan.push({ from: path, to: p.join("/"), doc });
}
const order = ["settings", "members", "items", "photos", "tasks", "logs", "reports", "idcc", "public", "pcal"];
plan.sort((a, b) => order.indexOf(a.to.split("/")[0]) - order.indexOf(b.to.split("/")[0]) || a.to.split("/").length - b.to.split("/").length);

const count = (xs: { to: string }[]) => Object.entries(xs.reduce<Record<string, number>>((m, x) => ((m[x.to.split("/")[0]] = (m[x.to.split("/")[0]] ?? 0) + 1), m), {}));
console.log("Rencana:", Object.fromEntries(count(plan)));
if (missing.length) console.log("Akun Tirtonichub belum ada (anggota ini dilewati):", missing);
if (skip.length) console.log("Dilewati (tidak ada di peta email):", skip);
if (dry) { console.log("--dry-run: tidak ada yang ditulis."); process.exit(0); }

let ok = 0;
const gagal: string[] = [];
for (const x of plan) {
  try {
    const data = { ...x.doc };
    if (x.to.startsWith("members/")) {
      // email lama diganti; akun & nama mengikuti Tirtonichub, isian Media (kode, peran, avatar) ikut pindah
      data.email = x.to.split("/")[1];
    }
    if (verbose) console.log("→", x.to);
    await writeDoc(system, "set", x.to, data, { trusted: true });
    ok++;
  } catch (e) {
    gagal.push(x.from + " → " + (e as Error).message);
  }
}
// hari libur mingguan per kode jobdesk (0=Min…6=Sab), hanya bila belum diisi
const OFF: Record<string, number[]> = { Z: [4], R: [2, 4], A: [4, 5], S: [4, 5] };
for (const [code, offDays] of Object.entries(OFF)) await prisma.mediaMember.updateMany({ where: { code, offDays: { isEmpty: true } }, data: { offDays } });
console.log(`Selesai: ${ok} dokumen ditulis, ${gagal.length} gagal.`);
for (const g of gagal) console.log("  gagal:", g);
await prisma.$disconnect();
