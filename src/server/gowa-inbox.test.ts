import { test } from "node:test";
import assert from "node:assert";
import { gowaAkun, parseGowa } from "./gowa-inbox";

test("parseGowa: format lama & v7, grup/receipt diabaikan", () => {
  const lama = parseGowa({ from: "6281234@s.whatsapp.net", pushname: "Budi", timestamp: "2026-11-28T10:00:00Z", message: { id: "ABC", text: "ready?" } }, "1");
  assert.deepStrictEqual([lama?.accountId, lama?.contactId, lama?.dir, lama?.text, lama?.name, lama?.metaId], ["gowa:1", "6281234", "in", "ready?", "Budi", "gowa:ABC"]);
  const v7 = parseGowa({ event: "message", device_id: "x", payload: { id: "D1", chat_id: "6289@s.whatsapp.net", from_me: true, body: "ada kak", timestamp: "2026-11-28T10:01:00Z" } }, "2");
  assert.deepStrictEqual([v7?.dir, v7?.contactId, v7?.text, v7?.name], ["out", "6289", "ada kak", undefined]);
  const foto = parseGowa({ from: "6281@s.whatsapp.net", message: { id: "F" }, image: { caption: "ini" } }, "1");
  assert.strictEqual(foto?.text, "[Foto] ini");
  assert.strictEqual(parseGowa({ from: "123@g.us", message: { id: "G", text: "grup" } }, "1"), null);
  assert.strictEqual(parseGowa({ event: "message.ack", payload: { id: "R" } }, "1"), null);
});

test("gowaAkun: parse env", () => {
  assert.deepStrictEqual(gowaAkun("Admin 1|http://h:3001|u:p, Admin 2|http://h:3002"), [
    { n: "1", label: "Admin 1", base: "http://h:3001", auth: "u:p" },
    { n: "2", label: "Admin 2", base: "http://h:3002", auth: undefined },
  ]);
});
