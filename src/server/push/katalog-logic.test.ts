import { test } from "node:test";
import assert from "node:assert/strict";
import { katalogBatchDue, katalogEntersReady, katalogShouldQueue, katalogWaText, maskPhone, studioFolderLink } from "./katalog-logic";

// Selasa 3 Nov 2026 14.20 WIB = 07.20 UTC
const t0 = new Date("2026-11-03T07:20:00Z");
const min = (m: number) => new Date(t0.getTime() + m * 60_000);

test("gabung 10 menit: kirim saat yang tertua sudah 10 menit", () => {
  assert.equal(katalogBatchDue([], min(30)), false);
  assert.equal(katalogBatchDue([{ movedAt: t0 }, { movedAt: min(8) }], min(9)), false);
  assert.equal(katalogBatchDue([{ movedAt: t0 }, { movedAt: min(8) }], min(10)), true);
});

test("link folder barang di File Studio", () => {
  process.env.APP_URL = "https://tirtonichub.com/";
  assert.equal(studioFolderLink("abc 1"), "https://tirtonichub.com/studio/?p=hasil&f=abc%201&s=ktl");
  assert.equal(studioFolderLink(null), "https://tirtonichub.com/studio/?p=hasil");
});

test("sekali per kartu", () => {
  assert.equal(katalogShouldQueue({}), true);
  assert.equal(katalogShouldQueue({ ktlNotifAt: 1 }), false);
});

test("pemicu: ktl masuk Ready/Tayang dari tahap awal saja", () => {
  assert.equal(katalogEntersReady({ status: "Editing" }, { type: "ktl", status: "Ready" }), true);
  assert.equal(katalogEntersReady({ status: "Editing" }, { type: "ktl", status: "Tayang" }), true);
  assert.equal(katalogEntersReady({ status: "Ready" }, { type: "ktl", status: "Tayang" }), false);
  assert.equal(katalogEntersReady({ status: "Tayang" }, { type: "ktl", status: "Tayang" }), false);
  assert.equal(katalogEntersReady({ status: "Editing" }, { type: "igf", status: "Ready" }), false);
  assert.equal(katalogEntersReady(null, { type: "ktl", status: "Ready" }), true);
});

test("pesan gabungan: per barang + siapa + jam WIB", () => {
  const txt = katalogWaText([
    { name: "Asics Gel Resolution 9", gender: "men", color: "putih-biru", link: "https://tirtonichub.com/studio/?p=hasil&f=A&s=ktl", movedBy: "Rayhan", movedAt: t0 },
    { name: "Wilson Pro Staff 97", gender: "", color: "hitam", link: "https://tirtonichub.com/studio/?p=hasil&f=B&s=ktl", movedBy: "Zaki", movedAt: min(8) },
  ]);
  assert.equal(
    txt,
    [
      "📸 Foto katalog siap",
      "",
      "1. *Asics Gel Resolution 9*",
      "Gender: Men · Warna: putih-biru",
      "Folder: https://tirtonichub.com/studio/?p=hasil&f=A&s=ktl",
      "",
      "2. *Wilson Pro Staff 97*",
      "Warna: hitam",
      "Folder: https://tirtonichub.com/studio/?p=hasil&f=B&s=ktl",
      "",
      "Dipindahkan oleh: Rayhan, Zaki",
      "Waktu: Selasa, 3 November 2026, 14.20–14.28 WIB",
    ].join("\n"),
  );
});

test("pesan satu barang dan tes", () => {
  const txt = katalogWaText([{ name: "Head Tour 9R", gender: "women", color: null, link: "https://tirtonichub.com/studio/?p=hasil", movedBy: "Rayhan", movedAt: t0 }], { test: true });
  assert.match(txt, /^📸 Foto katalog siap \(TES, contoh\)\n\n\*Head Tour 9R\*\nGender: Women\nFolder: https:\/\/tirtonichub.com\/studio\/\?p=hasil\n\nDipindahkan oleh: Rayhan\nWaktu: Selasa, 3 November 2026, 14.20 WIB$/);
});

test("nomor disamarkan", () => {
  assert.equal(maskPhone("6281234567890"), "0812****7890");
  assert.equal(maskPhone("081234567890"), "0812****7890");
});
