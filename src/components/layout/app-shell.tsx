"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { RightPanel, type RightNotif, type RightMember } from "./right-panel";
import { BottomNav } from "./bottom-nav";
import { FloatingChat, type Presence } from "@/components/chat/floating-chat";
import type { RoomListItem } from "@/server/chat/queries";

export function AppShell({
  children,
  notifications,
  members,
  rooms,
  presence,
  me,
  notifCount,
}: {
  children: React.ReactNode;
  notifications: RightNotif[];
  members: RightMember[];
  rooms: RoomListItem[];
  presence: Presence[];
  me: string;
  notifCount: number;
}) {
  const [panelOpen, setPanelOpen] = useState(true);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar notifCount={notifCount} notifications={notifications} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onTogglePanel={() => setPanelOpen((v) => !v)} />
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
            {children}
          </main>
          {panelOpen && <RightPanel notifications={notifications} />}
        </div>
      </div>
      <BottomNav />
      <FloatingChat rooms={rooms} presence={presence} members={members} me={me} />
    </div>
  );
}
