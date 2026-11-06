import { requireFinance } from "@/server/auth/rbac";
import { DanaCair } from "@/components/channel/dana-cair";

/** Finance: dana cair Shopee & Tokopedia (dari API marketplace). Menggantikan Dompet Online manual. */
export default async function FinanceDanaCairPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  await requireFinance();
  return <DanaCair searchParams={searchParams} />;
}
