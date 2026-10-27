import {
  Home,
  Clock,
  FileText,
  Bell,
  MessagesSquare,
  User,
  Users,
  Building2,
  CalendarClock,
  CalendarOff,
  ClipboardList,
  CheckSquare,
  ScrollText,
  MonitorSmartphone,
  Receipt,
  ClipboardCheck,
  Boxes,
  type LucideIcon,
} from "lucide-react";
import { HR_ROLES, FINANCE_ROLES, STOCK_ROLES, MEDIA_ROLES, SALES_ROLES, ADMIN_ROLES, roleAttends, type RoleCode } from "./roles";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** halaman di luar app Next (mis. UI statis /studio) → <a> biasa, muat ulang penuh */
  external?: boolean;
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
  // Chat desktop pindah ke widget mengambang (FloatingChat); mobile tetap di bottom-nav.
  // Kalender pindah ke Beranda (tidak ada menu terpisah).
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
        { label: "Hari Libur", href: "/hr/hari-libur", icon: CalendarOff },
        { label: "Rekap Absen", href: "/hr/rekap", icon: ClipboardList },
        { label: "Pengajuan Masuk", href: "/hr/approval", icon: CheckSquare },
        { label: "Log Aktivitas", href: "/hr/log", icon: ScrollText },
        { label: "Sesi Aktif", href: "/hr/sesi", icon: MonitorSmartphone },
      ],
    });
  }

  if (FINANCE_ROLES.includes(role)) {
    groups.push({
      title: "Finance",
      items: [
        { label: "Produk Mentah", href: "/finance", icon: Receipt },
        { label: "Rekap Penjualan", href: "/finance/penjualan", icon: Receipt },
      ],
    });
  }

  if (SALES_ROLES.includes(role)) {
    groups.push({
      title: "Sales",
      items: [{ label: "Rekap Penjualan", href: "/sales", icon: Receipt }],
    });
  }

  if (ADMIN_ROLES.includes(role)) {
    groups.push({
      title: "Admin",
      items: [{ label: "Penjualan Online", href: "/penjualan-online", icon: Receipt }],
    });
  }

  if (STOCK_ROLES.includes(role)) {
    groups.push({
      title: "Stok",
      items: [
        { label: "Quality Control", href: "/stok/qc", icon: ClipboardCheck },
        { label: "Stok", href: "/stok", icon: Boxes },
      ],
    });
  }

  if (MEDIA_ROLES.includes(role)) {
    groups.push({
      title: "Media",
      items: [
        { label: "Tirtonic Studio", href: "/studio", icon: MonitorSmartphone, external: true },
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
  items.push({ label: "Chat", href: "/chat", icon: MessagesSquare });
  items.push({ label: "Profil", href: "/profil", icon: User });
  return items; // Notifikasi via bell di header (hemat slot bottom nav)
}
