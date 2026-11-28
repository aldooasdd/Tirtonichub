-- Hapus chat contoh dari tombol Uji dashboard Meta (pengirim 12334).
DELETE FROM "InboxThread" WHERE "channel" = 'IG' AND "contactId" = '12334';
