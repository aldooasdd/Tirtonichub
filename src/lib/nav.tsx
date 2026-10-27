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
  Wallet,
  ShoppingCart,
  Globe,
  ClipboardCheck,
  Boxes,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { HR_ROLES, FINANCE_ROLES, STOCK_ROLES, MEDIA_ROLES, SALES_ROLES, ADMIN_ROLES, HEAD_BRANCH_ROLES, roleAttends, type RoleCode } from "./roles";
import { ABSEN_ON } from "./flags";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** halaman di luar app Next (mis. UI statis /studio) → <a> biasa, muat ulang penuh */
  external?: boolean;
};

export type NavGroup = {
  title?: string;
  icon?: LucideIcon; // ikon di header grup (role)
  items: NavItem[];
};

/** Warna ikon header grup (biar tak hitam-putih). Dipakai sidebar & menu HP. */
export const GROUP_COLOR: Record<string, string> = {
  HR: "text-pink-500",
  Finance: "text-blue-500",
  Sales: "text-emerald-500",
  Admin: "text-violet-500",
  Cabang: "text-indigo-500",
  Stok: "text-amber-500",
  Media: "text-cyan-500",
};

/** Menu sidebar sesuai role aktif. (PRD §6.1) */
export function navForRole(role: RoleCode): NavGroup[] {
  const umum: NavItem[] = [{ label: "Beranda", href: "/beranda", icon: Home }];
  if (ABSEN_ON && roleAttends(role)) {
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
      icon: Users,
      items: [
        { label: "Karyawan", href: "/hr/karyawan", icon: Users },
        { label: "Cabang", href: "/hr/cabang", icon: Building2 },
        { label: "Jadwal Kerja", href: "/hr/jadwal", icon: CalendarClock },
        { label: "Hari Libur", href: "/hr/hari-libur", icon: CalendarOff },
        ...(ABSEN_ON ? [{ label: "Rekap Absen", href: "/hr/rekap", icon: ClipboardList }] : []),
        { label: "Pengajuan Masuk", href: "/hr/approval", icon: CheckSquare },
        { label: "Log Aktivitas", href: "/hr/log", icon: ScrollText },
        { label: "Sesi Aktif", href: "/hr/sesi", icon: MonitorSmartphone },
      ],
    });
  }

  if (FINANCE_ROLES.includes(role)) {
    groups.push({
      title: "Finance",
      icon: Wallet,
      items: [
        { label: "Produk Mentah", href: "/finance", icon: Receipt },
        { label: "Rekap Penjualan", href: "/finance/penjualan", icon: Receipt },
        { label: "Sinkronisasi Accurate", href: "/finance/sinkronisasi", icon: FileText },
      ],
    });
  }

  if (SALES_ROLES.includes(role)) {
    groups.push({
      title: "Sales",
      icon: ShoppingCart,
      items: [{ label: "Rekap Penjualan", href: "/sales", icon: Receipt }],
    });
  }

  if (ADMIN_ROLES.includes(role)) {
    groups.push({
      title: "Admin",
      icon: Globe,
      items: [{ label: "Approval Online", href: "/penjualan-online", icon: ClipboardCheck }],
    });
  }

  if (HEAD_BRANCH_ROLES.includes(role)) {
    groups.push({
      title: "Cabang",
      icon: Building2,
      items: [{ label: "Approval Penjualan", href: "/cabang/penjualan", icon: ClipboardCheck }],
    });
  }

  if (STOCK_ROLES.includes(role)) {
    groups.push({
      title: "Stok",
      icon: Warehouse,
      items: [
        { label: "Quality Control", href: "/stok/qc", icon: ClipboardCheck },
        { label: "Stok", href: "/stok", icon: Boxes },
      ],
    });
  }

  if (MEDIA_ROLES.includes(role)) {
    groups.push({
      title: "Media",
      icon: MonitorSmartphone,
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
  if (ABSEN_ON && roleAttends(role)) items.push({ label: "Absen", href: "/absen", icon: Clock });
  items.push({ label: "Pengajuan", href: "/pengajuan", icon: FileText });
  items.push({ label: "Chat", href: "/chat", icon: MessagesSquare });
  items.push({ label: "Profil", href: "/profil", icon: User });
  return items; // Notifikasi via bell di header (hemat slot bottom nav)
}
