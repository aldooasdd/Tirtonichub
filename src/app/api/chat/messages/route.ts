import { NextRequest } from "next/server";
import { getSession } from "@/server/auth/session";
import { getMessages } from "@/server/chat/queries";

// Polling pesan baru (ponytail: real-time via poll ~3s; upgrade ke SSE/LISTEN-NOTIFY bila perlu).
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return new Response("Unauthorized", { status: 401 });

  const roomId = req.nextUrl.searchParams.get("room");
  const after = req.nextUrl.searchParams.get("after") || undefined;
  if (!roomId) return new Response("room wajib", { status: 400 });

  const msgs = await getMessages(roomId, s.user.id, after);
  if (msgs === null) return new Response("Forbidden", { status: 403 });
  return Response.json({ messages: msgs });
}
