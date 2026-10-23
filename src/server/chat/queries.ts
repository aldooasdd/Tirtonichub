import { prisma } from "@/server/db";
import { fileUrl } from "@/server/storage";

export type RoomListItem = {
  id: string;
  type: "GROUP" | "DM";
  name: string;
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
};

export async function listRooms(userId: string): Promise<RoomListItem[]> {
  const memberships = await prisma.chatMember.findMany({
    where: { userId },
    include: {
      room: {
        include: {
          members: { include: { user: { select: { id: true, fullName: true } } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  const items = await Promise.all(
    memberships.map(async (m) => {
      const room = m.room;
      const other = room.members.find((x) => x.userId !== userId);
      const name =
        room.type === "GROUP" ? (room.name ?? "Grup") : (other?.user.fullName ?? "DM");
      const last = room.messages[0];
      const unread = await prisma.chatMessage.count({
        where: {
          roomId: room.id,
          senderId: { not: userId },
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
        },
      });
      return {
        id: room.id,
        type: room.type,
        name,
        lastBody: last ? (last.body ?? "📷 Gambar") : null,
        lastAt: last ? last.createdAt.toISOString() : null,
        unread,
      };
    }),
  );

  items.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  return items;
}

export type ChatMsg = {
  id: string;
  body: string | null;
  imageUrl: string | null;
  senderId: string;
  senderName: string;
  createdAt: string;
};

export async function getMessages(
  roomId: string,
  userId: string,
  afterIso?: string,
): Promise<ChatMsg[] | null> {
  const member = await prisma.chatMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  if (!member) return null; // bukan anggota

  const rows = await prisma.chatMessage.findMany({
    where: {
      roomId,
      deletedAt: null,
      ...(afterIso ? { createdAt: { gt: new Date(afterIso) } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { sender: { select: { fullName: true } } },
  });

  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      body: r.body,
      imageUrl: r.attachmentKey ? await fileUrl(r.attachmentKey) : null,
      senderId: r.senderId,
      senderName: r.sender.fullName,
      createdAt: r.createdAt.toISOString(),
    })),
  );
}
