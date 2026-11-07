import { requireOnlineSales } from "@/server/auth/rbac";
import { listChats } from "@/server/actions/marketplace-chat";
import { MarketplaceChat } from "@/components/channel/marketplace-chat";
import { DEMO_CONVS } from "@/components/channel/marketplace-chat-demo";

export default async function ChatMarketplacePage({ searchParams }: { searchParams: Promise<{ contoh?: string }> }) {
  await requireOnlineSales();
  // ?contoh=1 → data contoh (untuk screenshot), tanpa memanggil API marketplace.
  const demo = (await searchParams).contoh === "1";
  const first = demo ? { convs: DEMO_CONVS, errors: [] } : await listChats();
  return <MarketplaceChat key={demo ? "contoh" : "asli"} initial={first} demo={demo} />;
}
