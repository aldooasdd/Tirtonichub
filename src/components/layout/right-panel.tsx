"use client";

import { Bell, Activity } from "lucide-react";

// Panel kanan: Notifikasi + Aktivitas. (PRD §6.1) Isi nyata menyusul.
export function RightPanel() {
  return (
    <aside className="hidden w-80 shrink-0 border-l bg-background p-4 lg:block">
      <section className="mb-6">
        <h3 className="mb-3 flex items-center gap-2 text-14 font-semibold">
          <Bell className="h-4 w-4" /> Notifikasi
        </h3>
        <p className="rounded-lg bg-muted p-4 text-14 text-muted-foreground">
          Belum ada notifikasi.
        </p>
      </section>
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-14 font-semibold">
          <Activity className="h-4 w-4" /> Aktivitas
        </h3>
        <p className="rounded-lg bg-muted p-4 text-14 text-muted-foreground">
          Belum ada aktivitas.
        </p>
      </section>
    </aside>
  );
}
