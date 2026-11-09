// Saklar fitur. Matikan tanpa hapus kode.
// Absen aktif: jam masuk & telat/alpa dihitung dari jadwal Shift hari itu.
export const ABSEN_ON = true;
// Produk Master → marketplace (ubah stok/harga, aktif/nonaktif, tambah/edit produk). Mati = hanya lihat.
// Dimatikan 2026-11-09 (user rapikan Produk Master), dinyalakan lagi 2026-11-09 atas permintaan user ("dibuat live").
export const PRODUK_KE_MARKETPLACE = true;
export const PRODUK_OFF_MSG = "Perubahan produk ke Shopee & Tokopedia sedang dimatikan.";
// Tirtonic.com ikut Produk Master: ubah nama/stok/harga di Produk Master langsung dikirim ke web.
// Terpisah dari PRODUK_KE_MARKETPLACE (Shopee/Tokopedia tetap mati). Dinyalakan 2026-11-09 atas permintaan user.
export const WEB_IKUT_PRODUK_MASTER = true;
/** Boleh kirim perubahan produk ke platform ini? */
export const bolehUbah = (platform: string) => PRODUK_KE_MARKETPLACE || (platform === "WEBSITE" && WEB_IKUT_PRODUK_MASTER);
