import { FlowspaceView } from "@/components/media/flowspace-view";

export const dynamic = "force-dynamic";

/** FlowSpace baru di dalam Studio (tanpa menu dasbor). */
export default async function FlowspaceEmbed() {
  return FlowspaceView();
}
