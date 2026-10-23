import { requireAuth, can } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { listRooms } from "@/server/chat/queries";
import { ChatClient } from "@/components/chat/chat-client";

export default async function ChatPage() {
  const ctx = await requireAuth();
  const [rooms, users] = await Promise.all([
    listRooms(ctx.userId),
    prisma.user.findMany({
      where: { isActive: true, id: { not: ctx.userId } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <ChatClient
      me={ctx.userId}
      rooms={rooms}
      users={users}
      canCreateGroup={can.manageEmployees(ctx.activeRole)}
    />
  );
}
