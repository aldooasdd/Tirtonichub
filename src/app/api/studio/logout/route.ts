import { destroyCurrentSession } from "@/server/auth/session";
import { ok } from "@/server/studio/http";

export async function POST() {
  await destroyCurrentSession();
  return ok({ ok: true });
}
