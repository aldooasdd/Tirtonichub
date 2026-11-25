import { loadAutomation } from "@/server/actions/automation";
import { AutomationClient } from "@/components/media/automation-client";

export const dynamic = "force-dynamic";

export default async function OtomasiPage() {
  const r = await loadAutomation();
  if (!r.ok) return <div className="p-6 text-sm text-muted-foreground">Halaman Otomasi hanya untuk admin penuh.</div>;
  return <AutomationClient initial={r.data} />;
}
