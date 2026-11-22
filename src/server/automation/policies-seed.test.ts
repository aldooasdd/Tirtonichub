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
