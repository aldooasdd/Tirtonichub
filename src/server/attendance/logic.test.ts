import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateKeyWIB,
  wibWeekday,
  computeCheckInStatus,
  withinRadius,
  haversine,
} from "./logic";

test("dateKeyWIB pakai batas hari WIB (bukan UTC)", () => {
  // 2026-01-01T20:00Z = 2026-01-02 03:00 WIB
  const d = dateKeyWIB(new Date(Date.UTC(2026, 0, 1, 20, 0)));
  assert.equal(d.getUTCFullYear(), 2026);
  assert.equal(d.getUTCMonth(), 0);
  assert.equal(d.getUTCDate(), 2);
});

test("wibWeekday: Kamis=4", () => {
  // 2026-01-01 adalah Kamis
  assert.equal(wibWeekday(new Date(Date.UTC(2026, 0, 1, 5, 0))), 4);
});

test("status tepat waktu dalam toleransi", () => {
  // 08:55 WIB = 01:55 UTC, jadwal 09:00 tol 10
  const r = computeCheckInStatus(new Date(Date.UTC(2026, 0, 1, 1, 55)), {
    startTime: "09:00",
    lateToleranceMin: 10,
  });
  assert.deepEqual(r, { status: "ON_TIME", lateMinutes: 0 });
});

test("status terlambat di luar toleransi", () => {
  // 09:15 WIB = 02:15 UTC
  const r = computeCheckInStatus(new Date(Date.UTC(2026, 0, 1, 2, 15)), {
    startTime: "09:00",
    lateToleranceMin: 10,
  });
  assert.deepEqual(r, { status: "LATE", lateMinutes: 15 });
});

test("radius: dalam jangkauan diterima", () => {
  const b = { lat: -7.79, lng: 110.36 };
  const r = withinRadius({ lat: -7.79, lng: 110.36, accuracy: 5 }, b, 50);
  assert.equal(r.ok, true);
});

test("radius: jauh ditolak, tapi akurasi besar memaafkan", () => {
  const b = { lat: -7.79, lng: 110.36 };
  const far = { lat: -7.79 + 0.0009, lng: 110.36 }; // ~100 m
  assert.equal(withinRadius({ ...far, accuracy: 5 }, b, 50).ok, false);
  assert.equal(withinRadius({ ...far, accuracy: 60 }, b, 50).ok, true); // 100-60<=50
});

test("haversine ~100m untuk 0.0009° lintang", () => {
  const d = haversine(-7.79, 110.36, -7.79 + 0.0009, 110.36);
  assert.ok(d > 90 && d < 110, `distance=${d}`);
});
