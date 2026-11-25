import { loadAutomation } from "@/server/actions/automation";
import { AutomationClient } from "@/components/media/automation-client";

export const dynamic = "force-dynamic";

/** Otomasi di dalam Studio (tanpa menu dasbor). Sama dengan /media/otomasi. */
export default async function OtomasiEmbed() {
  const r = await loadAutomation();
  if (!r.ok) return <div className="p-6 text-sm text-muted-foreground">Halaman Otomasi hanya untuk admin penuh.</div>;
  return <AutomationClient initial={r.data} />;
}
