// Data contoh Chat Pembeli (/penjualan-online/chat?contoh=1) untuk screenshot pengajuan izin Chat API.
import type { ChatConv } from "@/server/actions/marketplace-chat";
import type { MpMsg } from "@/server/marketplace/shopee";

const ago = (min: number) => Date.now() - min * 60_000;

export const DEMO_CONVS: ChatConv[] = [
  { platform: "TOKOPEDIA", id: "tp1", name: "rizky.tennis", avatar: null, last: "Kak, senar Yonex Poly Tour Pro 1.25 ready warna kuning?", at: ago(2), unread: 2, toId: "b1" },
  { platform: "SHOPEE", id: "sp1", name: "dinda_sport", avatar: null, last: "Ukuran 40 masih ada kak?", at: ago(9), unread: 1, toId: "b2" },
  { platform: "SHOPEE", id: "sp2", name: "hendra88", avatar: null, last: "Siap kak, terima kasih 🙏", at: ago(47), unread: 0, toId: "b3" },
  { platform: "TOKOPEDIA", id: "tp2", name: "maya.ace", avatar: null, last: "Resinya sudah keluar ya kak", at: ago(130), unread: 0, toId: "b4" },
  { platform: "SHOPEE", id: "sp3", name: "budi.smash", avatar: null, last: "Bisa minta tolong bungkus kado?", at: ago(60 * 26), unread: 0, toId: "b5" },
];

const m = (id: string, mine: boolean, text: string, min: number): MpMsg => ({ id, mine, text, image: null, at: ago(min) });

export const DEMO_MSGS: Record<string, MpMsg[]> = {
  tp1: [
    m("1", false, "Halo kak, mau tanya", 6),
    m("2", true, "Halo kak, selamat datang di Tirtonic Tennis Store. Ada yang bisa kami bantu?", 5),
    m("3", false, "Kak, senar Yonex Poly Tour Pro 1.25 ready warna kuning?", 2),
    m("4", false, "Sekalian bisa dipasang sekalian ke raket?", 2),
  ],
  sp1: [
    m("1", false, "Kak sepatu Asics Gel Resolution 9 ukuran 40 masih ada kak?", 9),
  ],
  sp2: [
    m("1", false, "Kak pesanan saya kapan dikirim?", 70),
    m("2", true, "Halo kak, pesanan sudah kami kemas dan dikirim hari ini sebelum jam 16.00 ya.", 55),
    m("3", false, "Siap kak, terima kasih 🙏", 47),
  ],
  tp2: [
    m("1", false, "Kak paket saya sudah dikirim?", 150),
    m("2", true, "Sudah kak, nomor resi sudah kami input di pesanan. Bisa dicek di menu pesanan ya.", 135),
    m("3", false, "Resinya sudah keluar ya kak", 130),
  ],
  sp3: [
    m("1", false, "Bisa minta tolong bungkus kado?", 60 * 26),
    m("2", true, "Bisa kak, nanti kami bungkus rapi. Mau ditambah kartu ucapan?", 60 * 25),
  ],
};
