import { requireOnlineSales } from "@/server/auth/rbac";
import { listChats } from "@/server/actions/marketplace-chat";
import { MarketplaceChat } from "@/components/channel/marketplace-chat";

export default async function ChatMarketplacePage() {
  await requireOnlineSales();
  const first = await listChats();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-24 font-semibold">Chat Pembeli</h1>
        <p className="text-14 text-muted-foreground">Balas chat pembeli Shopee & Tokopedia dari sini.</p>
      </div>
      <MarketplaceChat initial={first} />
    </div>
  );
}
