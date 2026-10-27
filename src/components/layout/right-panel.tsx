import type { RoleCode } from "@/lib/roles";

// Panel kanan dihapus. Tipe ini masih dipakai layout/AppShell/Sidebar/FloatingChat.
export type RightNotif = { id: string; title: string; time: string; link: string | null };
export type RightMember = { id: string; name: string; role: RoleCode | null; active: boolean };
