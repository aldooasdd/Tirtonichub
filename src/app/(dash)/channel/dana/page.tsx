import { requireChannel } from "@/server/auth/rbac";
import { DanaCair } from "@/components/channel/dana-cair";

export default async function ChannelDanaPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  await requireChannel();
  return <DanaCair searchParams={searchParams} />;
}
