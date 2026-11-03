import { test } from "node:test";
import assert from "node:assert/strict";
import { isDriveFolderLink, katalogBatchDue, katalogEntersReady, katalogShouldQueue, katalogWaText, maskPhone } from "./katalog-logic";

// Selasa 3 Nov 2026 14.20 WIB = 07.20 UTC
const t0 = new Date("2026-11-03T07:20:00Z");
const min = (m: number) => new Date(t0.getTime() + m * 60_000);

test("gabung 10 menit: kirim saat yang tertua sudah 10 menit", () => {
  assert.equal(katalogBatchDue([], min(30)), false);
  assert.equal(katalogBatchDue([{ movedAt: t0 }, { movedAt: min(8) }], min(9)), false);
  assert.equal(katalogBatchDue([{ movedAt: t0 }, { movedAt: min(8) }], min(10)), true);
});

test("link folder Google Drive", () => {
  assert.equal(isDriveFolderLink("https://drive.google.com/drive/folders/abc123"), true);
  assert.equal(isDriveFolderLink("https://docs.google.com/x"), true);
  assert.equal(isDriveFolderLink("/api/file?key=a"), false);
  assert.equal(isDriveFolderLink("http://drive.google.com/x"), false);
  assert.equal(isDriveFolderLink("https://example.com/drive.google.com"), false);
  assert.equal(isDriveFolderLink(""), false);
  assert.equal(isDriveFolderLink(undefined), false);
});

test("sekali per kartu, kirim ulang hanya bila link berubah", () => {
  assert.equal(katalogShouldQueue({}, "https://drive.google.com/a"), true);
  assert.equal(katalogShouldQueue({ ktlNotifAt: 1, ktlNotifUrl: "https://drive.google.com/a" }, "https://drive.google.com/a"), false);
  assert.equal(katalogShouldQueue({ ktlNotifAt: 1, ktlNotifUrl: "https://drive.google.com/a" }, "https://drive.google.com/b"), true);
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
    { name: "Asics Gel Resolution 9", gender: "men", color: "putih-biru", driveUrl: "https://drive.google.com/drive/folders/A", movedBy: "Rayhan", movedAt: t0 },
    { name: "Wilson Pro Staff 97", gender: "", color: "hitam", driveUrl: "https://drive.google.com/drive/folders/B", movedBy: "Zaki", movedAt: min(8) },
  ]);
  assert.equal(
    txt,
    [
      "📸 Foto katalog siap",
      "",
      "1. *Asics Gel Resolution 9*",
      "Gender: Men · Warna: putih-biru",
      "Folder: https://drive.google.com/drive/folders/A",
      "",
      "2. *Wilson Pro Staff 97*",
      "Warna: hitam",
      "Folder: https://drive.google.com/drive/folders/B",
      "",
      "Dipindahkan oleh: Rayhan, Zaki",
      "Waktu: Selasa, 3 November 2026, 14.20–14.28 WIB",
    ].join("\n"),
  );
});

test("pesan satu barang dan tes", () => {
  const txt = katalogWaText([{ name: "Head Tour 9R", gender: "women", color: null, driveUrl: "https://drive.google.com/x", movedBy: "Rayhan", movedAt: t0 }], { test: true });
  assert.match(txt, /^📸 Foto katalog siap \(TES, contoh\)\n\n\*Head Tour 9R\*\nGender: Women\nFolder: https:\/\/drive.google.com\/x\n\nDipindahkan oleh: Rayhan\nWaktu: Selasa, 3 November 2026, 14.20 WIB$/);
});

test("nomor disamarkan", () => {
  assert.equal(maskPhone("6281234567890"), "0812****7890");
  assert.equal(maskPhone("081234567890"), "0812****7890");
});
