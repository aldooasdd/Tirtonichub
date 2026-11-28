import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kebijakan Privasi — Tirtonichub" };

/** Halaman publik: URL Kebijakan Privasi untuk app Meta (Inbox WA & IG). */
export default function PrivasiPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-10 text-14 leading-relaxed">
      <h1 className="text-24 font-semibold">Kebijakan Privasi Tirtonichub</h1>
      <p>Tirtonichub adalah sistem internal Tirtonic Tennis Store (Jogja, Solo, Semarang) untuk mengelola toko, termasuk membalas pesan pelanggan dari WhatsApp dan Instagram.</p>
      <h2 className="text-16 font-semibold">Data yang kami terima</h2>
      <p>Saat Anda mengirim pesan ke WhatsApp atau Instagram Tirtonic, kami menerima isi pesan, nama profil, nomor WhatsApp atau ID Instagram Anda, dan waktu pesan melalui layanan resmi Meta.</p>
      <h2 className="text-16 font-semibold">Penggunaan data</h2>
      <p>Data hanya dipakai untuk membalas pertanyaan, melayani pesanan, dan layanan purna jual Tirtonic. Data tidak dijual dan tidak dibagikan ke pihak lain, kecuali Meta sebagai penyedia layanan pesan dan bila diwajibkan hukum.</p>
      <h2 className="text-16 font-semibold">Penyimpanan dan keamanan</h2>
      <p>Data disimpan di server Tirtonic dan hanya dapat diakses staf Tirtonic yang berwenang.</p>
      <h2 className="text-16 font-semibold">Penghapusan data</h2>
      <p>Anda dapat meminta riwayat percakapan Anda dihapus dengan mengirim pesan &quot;hapus data saya&quot; ke WhatsApp atau Instagram @tirtonic.id, atau melalui email ke alamat yang tercantum di tirtonic.com. Permintaan diproses paling lambat 30 hari.</p>
      <p className="text-12 text-muted-foreground">Terakhir diperbarui 28 November 2026.</p>
    </main>
  );
}
