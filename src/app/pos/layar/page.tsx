import type { Metadata } from "next";
import { getPosBranch } from "@/server/pos";
import { CustomerDisplay } from "@/components/pos/customer-display";

export const metadata: Metadata = { title: "Layar pembeli · Tirtonic" };

/** Layar depan (layar pembeli iMin). Login mesin di /pos dulu; data keranjang dari tab /pos di perangkat sama. */
export default async function LayarPage() {
  const branch = await getPosBranch();
  if (!branch)
    return <div className="grid min-h-screen place-items-center bg-[#1a1a1a] p-8 text-center text-white">Login mesin kasir dulu di /pos, lalu buka halaman ini di layar depan.</div>;
  // Sementara hanya keranjang live + transaksi berhasil; campaign belum ditampilkan (aktifkan lagi: muat posCampaign aktif → slides).
  // Rencana: QRIS payment gateway tampil di layar ini.
  return <CustomerDisplay branch={branch.name} slides={[]} />;
}
