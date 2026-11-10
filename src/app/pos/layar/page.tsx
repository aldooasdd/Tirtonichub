import type { Metadata } from "next";
import { prisma } from "@/server/db";
import { getPosBranch } from "@/server/pos";
import { CustomerDisplay } from "@/components/pos/customer-display";

export const metadata: Metadata = { title: "Layar pembeli · Tirtonic" };

/** Layar depan (layar pembeli iMin). Login mesin di /pos dulu; data keranjang dari tab /pos di perangkat sama. */
export default async function LayarPage() {
  const branch = await getPosBranch();
  if (!branch)
    return <div className="grid min-h-screen place-items-center bg-[#1a1a1a] p-8 text-center text-white">Login mesin kasir dulu di /pos, lalu buka halaman ini di layar depan.</div>;
  const campaigns = await prisma.posCampaign.findMany({
    where: { active: true, OR: [{ branchId: null }, { branchId: branch.id }] },
    orderBy: { createdAt: "desc" },
    select: { id: true, mediaKey: true, isVideo: true },
  });
  return (
    <CustomerDisplay
      branch={branch.name}
      slides={campaigns.map((c) => ({ id: c.id, url: `/api/file?key=${encodeURIComponent(c.mediaKey)}`, isVideo: c.isVideo }))}
    />
  );
}
