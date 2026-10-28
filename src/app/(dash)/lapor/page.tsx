import { requireAuth } from "@/server/auth/rbac";
import { LaporClient } from "@/components/lapor/lapor-client";

export default async function LaporPage() {
  await requireAuth();
  return <LaporClient />;
}
