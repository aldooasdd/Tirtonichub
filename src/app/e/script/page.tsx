import { ScriptView } from "@/components/media/script-view";

export const dynamic = "force-dynamic";

export default async function ScriptPage({ searchParams }: { searchParams: Promise<{ card?: string }> }) {
  const sp = await searchParams;
  return ScriptView({ card: typeof sp.card === "string" ? sp.card : undefined });
}
