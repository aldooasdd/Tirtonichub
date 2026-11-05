import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { scanProductViaN8n } from "./n8n-product-scan";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.N8N_PRODUCT_SCAN_WEBHOOK_URL;
});

test("webhook belum diatur: fitur mati, tidak memanggil apa pun", async () => {
  delete process.env.N8N_PRODUCT_SCAN_WEBHOOK_URL;
  const r = await scanProductViaN8n("x", "image/jpeg", "");
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.off, true);
});

test("hasil n8n dinormalkan; gender hanya untuk sepatu/baju/celana", async () => {
  process.env.N8N_PRODUCT_SCAN_WEBHOOK_URL = "http://n8n.test/x";
  globalThis.fetch = (async () => Response.json({ name: " Asics Gel ", color: "PUTIH", category: "Sepatu", gender: "Men" })) as typeof fetch;
  assert.deepEqual(await scanProductViaN8n("x", "image/jpeg", ""), { ok: true, data: { name: "Asics Gel", color: "putih", category: "sepatu", gender: "men" } });
  globalThis.fetch = (async () => Response.json({ name: "Tas", color: "", category: "tas", gender: "men" })) as typeof fetch;
  const t = await scanProductViaN8n("x", "image/jpeg", "");
  assert.equal(t.ok && t.data.gender, "");
});

test("n8n gagal: pesan untuk isi manual, bukan fitur mati", async () => {
  process.env.N8N_PRODUCT_SCAN_WEBHOOK_URL = "http://n8n.test/x";
  globalThis.fetch = (async () => new Response("no", { status: 500 })) as typeof fetch;
  const r = await scanProductViaN8n("x", "image/jpeg", "");
  assert.equal(r.ok, false);
  assert.equal(!r.ok && !!r.off, false);
});
