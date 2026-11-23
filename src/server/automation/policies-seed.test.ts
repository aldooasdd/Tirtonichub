import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { policyConfigWhy, type PolicyKey } from "./policies";

test("aturan di migrasi keputusan Zaki sah menurut validasi aturan", () => {
  const sql = readFileSync("prisma/migrations/20261122150000_automation_policies/migration.sql", "utf8");
  const rows = [...sql.matchAll(/\('([a-z.]+)', 'active', '(\{[^']+\})'/g)];
  assert.equal(rows.length, 4);
  for (const [, k, cfg] of rows) assert.equal(policyConfigWhy(k as PolicyKey, JSON.parse(cfg)), null, k);
});

test("aturan 'lebih tenang' (D+7 saja, aplikasi saja) sah menurut validasi", () => {
  const sql = readFileSync("prisma/migrations/20261122210000_automation_policies_quiet/migration.sql", "utf8");
  const rows = [...sql.matchAll(/WHERE "key" = '([a-z.]+)' AND "config" <> '(\{[^']+\})'/g)];
  assert.equal(rows.length, 2);
  for (const [, k, cfg] of rows) assert.equal(policyConfigWhy(k as PolicyKey, JSON.parse(cfg)), null, k);
});

test("E D+7 + WhatsApp sah", () => {
  const sql = readFileSync("prisma/migrations/20261123090000_automation_perf_wa/migration.sql", "utf8");
  const m = sql.match(/WHERE "key" = '([a-z.]+)' AND "config" <> '(\{[^']+\})'/)!;
  assert.equal(policyConfigWhy(m[1] as PolicyKey, JSON.parse(m[2])), null);
});
