"use client";

import { Sidebar } from "./sidebar";
import { Header } from "./header";
import type { RightNotif } from "./right-panel";
import { BottomNav } from "./bottom-nav";

export function AppShell({
  children,
  notifications,
  notifCount,
}: {
  children: React.ReactNode;
  notifications: RightNotif[];
  notifCount: number;
}) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar notifCount={notifCount} notifications={notifications} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-w-0 flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
