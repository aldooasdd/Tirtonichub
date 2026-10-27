import { requireFinance } from "@/server/auth/rbac";
import { AccurateSync } from "@/components/finance/accurate-sync";

export default async function SinkronisasiPage() {
  await requireFinance();
  return <AccurateSync />;
}
