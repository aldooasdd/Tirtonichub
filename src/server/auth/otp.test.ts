import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/server/db";
import { hashValue } from "./hash";
import { requestOtp, verifyOtp } from "./otp";

const EMAIL = `otptest+${Date.now()}@example.com`;

async function cleanup() {
  await prisma.otpChallenge.deleteMany({ where: { email: { startsWith: "otptest+" } } });
}

before(cleanup);
after(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("request membuat OTP, verify kode benar → ok, sekali pakai", async () => {
  const r = await requestOtp(EMAIL);
  assert.ok(r.ok && r.code);
  if (!r.ok) return;

  const ok = await verifyOtp(EMAIL, r.code);
  assert.equal(ok.ok, true);

  // sudah consumed → tak ada challenge aktif lagi (sekali pakai)
  const again = await verifyOtp(EMAIL, r.code);
  assert.deepEqual(again, { ok: false, reason: "no_challenge" });
});

test("kode salah menambah attempts, 5x salah → locked", async () => {
  const email = `otptest+lock${Date.now()}@example.com`;
  const r = await requestOtp(email);
  assert.ok(r.ok);

  let last;
  for (let i = 0; i < 5; i++) {
    last = await verifyOtp(email, "000000" === (r as { code: string }).code ? "111111" : "000000");
  }
  assert.deepEqual(last, { ok: false, reason: "locked" });
});

test("kode kedaluwarsa ditolak", async () => {
  const email = `otptest+exp${Date.now()}@example.com`;
  const code = "123456";
  await prisma.otpChallenge.create({
    data: {
      email,
      codeHash: hashValue(code),
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  const res = await verifyOtp(email, code);
  assert.deepEqual(res, { ok: false, reason: "expired" });
});

test("kode tak pernah disimpan dalam bentuk asli (hanya hash)", async () => {
  const email = `otptest+hash${Date.now()}@example.com`;
  const r = await requestOtp(email);
  assert.ok(r.ok && r.code);
  if (!r.ok) return;
  const row = await prisma.otpChallenge.findFirst({ where: { email } });
  assert.ok(row);
  assert.notEqual(row!.codeHash, r.code); // bukan plaintext
  assert.equal(row!.codeHash, hashValue(r.code)); // cocok hash
});
