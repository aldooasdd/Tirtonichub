import { test } from "node:test";
import assert from "node:assert";
import { createHmac } from "node:crypto";
import { kontakMeta, parseMeta, sahMeta } from "./meta-inbox";

test("parseMeta: WA masuk + echo dari HP + IG masuk/echo", () => {
  const wa = parseMeta({
    object: "whatsapp_business_account",
    entry: [{ changes: [
      { field: "messages", value: { metadata: { phone_number_id: "P1" }, contacts: [{ wa_id: "6281", profile: { name: "Budi" } }], messages: [{ from: "6281", id: "w1", timestamp: "1700000000", type: "text", text: { body: "ready raket?" } }, { from: "6281", id: "w2", timestamp: "1700000001", type: "image", image: { caption: "ini" } }] } },
      { field: "smb_message_echoes", value: { metadata: { phone_number_id: "P1" }, message_echoes: [{ from: "P", to: "6281", id: "w3", timestamp: "1700000002", type: "text", text: { body: "ready kak" } }] } },
    ] }],
  });
  assert.deepStrictEqual(wa.map((m) => [m.contactId, m.dir, m.text, m.name]), [["6281", "in", "ready raket?", "Budi"], ["6281", "in", "[Foto] ini", "Budi"], ["6281", "out", "ready kak", undefined]]);
  const ig = parseMeta({ object: "instagram", entry: [{ id: "IG1", messaging: [{ sender: { id: "u9" }, recipient: { id: "IG1" }, timestamp: 1700000000000, message: { mid: "m1", text: "halo" } }, { sender: { id: "IG1" }, recipient: { id: "u9" }, timestamp: 1700000001000, message: { mid: "m2", text: "hai", is_echo: true } }] }] });
  assert.deepStrictEqual(ig.map((m) => [m.accountId, m.contactId, m.dir]), [["IG1", "u9", "in"], ["IG1", "u9", "out"]]);
});

test("parseMeta: tombol Uji dashboard (changes, timestamp teks detik)", () => {
  const ev = parseMeta({ object: "instagram", entry: [{ id: "0", time: 1700000000, changes: [{ field: "messages", value: { sender: { id: "12334" }, recipient: { id: "23245" }, timestamp: "1527459824", message: { mid: "random_mid", text: "random_text" } } }] }] });
  assert.strictEqual(ev.length, 1);
  assert.strictEqual(ev[0].text, "random_text");
  assert.strictEqual(ev[0].at.getUTCFullYear(), 2018);
});

test("parseMeta + kontakMeta: riwayat coexistence & kontak HP", () => {
  const p = { object: "whatsapp_business_account", entry: [{ changes: [{ field: "history", value: { metadata: { phone_number_id: "P1" }, history: [{ threads: [{ id: "6281", messages: [{ from: "6281", id: "h1", timestamp: "1700000000", type: "text", text: { body: "lama" } }, { from: "6280000", id: "h2", timestamp: "1700000005", type: "text", text: { body: "balasan lama" } }] }] }] } }] }] };
  assert.deepStrictEqual(parseMeta(p).map((m) => [m.dir, m.riwayat]), [["in", true], ["out", true]]);
  const k = kontakMeta({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "smb_app_state_sync", value: { metadata: { phone_number_id: "P1" }, state_sync: [{ type: "contact", action: "add", contact: { full_name: "Budi Raket", phone_number: "+62 81" } }] } }] }] });
  assert.deepStrictEqual(k, [{ accountId: "P1", contactId: "6281", name: "Budi Raket" }]);
});

test("parseMeta: komentar IG & Messenger FB + foto", () => {
  const k = parseMeta({ object: "instagram", entry: [{ id: "IG1", time: 1700000000, changes: [{ field: "comments", value: { id: "C1", text: "harga berapa?", from: { id: "u5", username: "budi" }, media: { id: "M1" } } }, { field: "comments", value: { id: "C2", text: "dm ya", from: { id: "IG1", username: "tirtonic.id" } } }] }] });
  assert.deepStrictEqual(k.map((m) => [m.channel, m.contactId, m.name, m.text, m.metaId]), [["IGK", "u5", "@budi", "[Komentar] harga berapa?", "c:C1"]]);
  const fb = parseMeta({ object: "page", entry: [{ id: "PG", messaging: [{ sender: { id: "p9" }, recipient: { id: "PG" }, timestamp: 1700000000000, message: { mid: "f1", attachments: [{ type: "image", payload: { url: "https://cdn/x.jpg" } }] } }] }] });
  assert.deepStrictEqual(fb.map((m) => [m.channel, m.accountId, m.text, m.mediaUrl]), [["FB", "PG", "[Foto]", "https://cdn/x.jpg"]]);
});

test("sahMeta: tanda tangan benar / salah", () => {
  const sig = "sha256=" + createHmac("sha256", "s3").update("{}").digest("hex");
  assert.ok(sahMeta("{}", sig, "s3"));
  assert.ok(!sahMeta("{} ", sig, "s3"));
  assert.ok(!sahMeta("{}", null, "s3"));
});
