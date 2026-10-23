"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { RightPanel, type RightNotif, type RightAct } from "./right-panel";
import { BottomNav } from "./bottom-nav";

export function AppShell({
  children,
  notifications,
  activities,
}: {
  children: React.ReactNode;
  notifications: RightNotif[];
  activities: RightAct[];
}) {
  const [panelOpen, setPanelOpen] = useState(true);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onTogglePanel={() => setPanelOpen((v) => !v)} />
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
            {children}
          </main>
          {panelOpen && <RightPanel notifications={notifications} activities={activities} />}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
