import { test } from "node:test";
import assert from "node:assert";
import { createHmac } from "node:crypto";
import { parseMeta, sahMeta } from "./meta-inbox";

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

test("sahMeta: tanda tangan benar / salah", () => {
  const sig = "sha256=" + createHmac("sha256", "s3").update("{}").digest("hex");
  assert.ok(sahMeta("{}", sig, "s3"));
  assert.ok(!sahMeta("{} ", sig, "s3"));
  assert.ok(!sahMeta("{}", null, "s3"));
});
