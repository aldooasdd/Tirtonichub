-- Tambah kolom password. Backfill akun lama lewat app (loginAction) saat login pertama.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

-- OTP tak dipakai lagi (login pakai password).
DROP TABLE IF EXISTS "OtpChallenge";
