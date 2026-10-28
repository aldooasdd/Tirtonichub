import { requireAuth } from "@/server/auth/rbac";
import { StringingScanClient } from "@/components/stringing/stringing-scan-client";

export default async function StringingScanPage() {
  await requireAuth();
  return <StringingScanClient />;
}
