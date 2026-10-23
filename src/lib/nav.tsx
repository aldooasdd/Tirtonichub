import {
  Home,
  Clock,
  FileText,
  Bell,
  User,
  Users,
  Building2,
  CalendarClock,
  ClipboardList,
  CheckSquare,
  ScrollText,
  MonitorSmartphone,
  type LucideIcon,
} from "lucide-react";
import { HR_ROLES, roleAttends, type RoleCode } from "./roles";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  title?: string;
  items: NavItem[];
};

/** Menu sidebar sesuai role aktif. (PRD §6.1) */
export function navForRole(role: RoleCode): NavGroup[] {
  const umum: NavItem[] = [{ label: "Beranda", href: "/beranda", icon: Home }];
  if (roleAttends(role)) {
    umum.push({ label: "Absen", href: "/absen", icon: Clock });
    umum.push({ label: "Riwayat Absen", href: "/riwayat-absen", icon: ClipboardList });
  }
  umum.push({ label: "Pengajuan", href: "/pengajuan", icon: FileText });
  umum.push({ label: "Notifikasi", href: "/notifikasi", icon: Bell });
  umum.push({ label: "Profil", href: "/profil", icon: User });

  const groups: NavGroup[] = [{ items: umum }];

  if (HR_ROLES.includes(role)) {
    groups.push({
      title: "HR",
      items: [
        { label: "Karyawan", href: "/hr/karyawan", icon: Users },
        { label: "Cabang", href: "/hr/cabang", icon: Building2 },
        { label: "Jadwal Kerja", href: "/hr/jadwal", icon: CalendarClock },
        { label: "Rekap Absen", href: "/hr/rekap", icon: ClipboardList },
        { label: "Pengajuan Masuk", href: "/hr/approval", icon: CheckSquare },
        { label: "Log Aktivitas", href: "/hr/log", icon: ScrollText },
        { label: "Sesi Aktif", href: "/hr/sesi", icon: MonitorSmartphone },
      ],
    });
  }

  return groups;
}

/** Bottom nav HP: 5 item. (PRD §6.1) */
export function bottomNavForRole(role: RoleCode): NavItem[] {
  const items: NavItem[] = [{ label: "Beranda", href: "/beranda", icon: Home }];
  if (roleAttends(role)) items.push({ label: "Absen", href: "/absen", icon: Clock });
  items.push({ label: "Pengajuan", href: "/pengajuan", icon: FileText });
  items.push({ label: "Notifikasi", href: "/notifikasi", icon: Bell });
  items.push({ label: "Profil", href: "/profil", icon: User });
  return items;
}
