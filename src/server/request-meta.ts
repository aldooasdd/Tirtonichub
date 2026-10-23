import { headers } from "next/headers";

export async function clientMeta() {
  const h = await headers();
  const ip =
    (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim() || null;
  const userAgent = h.get("user-agent") || null;
  return { ip, userAgent };
}
