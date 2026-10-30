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
  Receipt,
  Wallet,
  ShoppingCart,
  Globe,
  ClipboardCheck,
  Boxes,
  Warehouse,
  AlertCircle,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { HR_ROLES, FINANCE_ROLES, STOCK_ROLES, MEDIA_ROLES, SALES_ROLES, ORDER_SPECIALIST_ROLES, HEAD_BRANCH_ROLES, ADMIN_ROLES, roleAttends, type RoleCode } from "./roles";
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
  "Order Specialist": "text-violet-500",
  Cabang: "text-indigo-500",
  Stok: "text-amber-500",
  Media: "text-cyan-500",
  Admin: "text-red-500",
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
  umum.push({ label: "Lapor", href: "/lapor", icon: AlertCircle });
  umum.push({ label: "Profil", href: "/profil", icon: User });

  const groups: NavGroup[] = [{ items: umum }];

  if (ADMIN_ROLES.includes(role)) {
    groups.push({
      title: "Admin",
      icon: Inbox,
      items: [{ label: "Laporan Masuk", href: "/admin/laporan", icon: Inbox }],
    });
  }

  if (HR_ROLES.includes(role)) {
    groups.push({
      title: "HR",
      icon: Users,
      items: [
        { label: "Karyawan", href: "/hr/karyawan", icon: Users },
        { label: "Cabang", href: "/hr/cabang", icon: Building2 },
        { label: "Jadwal Kerja", href: "/hr/jadwal", icon: CalendarClock },
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
        { label: "Purchasing", href: "/finance", icon: Receipt },
        { label: "Approval Penjualan", href: "/cabang/penjualan", icon: ClipboardCheck },
        { label: "Input Pembelian", href: "/pembelian", icon: Wallet },
        { label: "Rekap Penjualan", href: "/finance/penjualan", icon: Receipt },
        { label: "Report Penjualan", href: "/finance/report-penjualan", icon: AlertCircle },
        { label: "Rekap Pembelian", href: "/finance/pembelian", icon: Wallet },
        { label: "Saldo Kasir", href: "/finance/kas", icon: Wallet },
        { label: "Sinkronisasi Accurate", href: "/finance/sinkronisasi", icon: FileText },
      ],
    });
  }

  if (SALES_ROLES.includes(role)) {
    groups.push({
      title: "Sales",
      icon: ShoppingCart,
      items: [
        { label: "Input Penjualan", href: "/sales", icon: Receipt },
        { label: "Input Pembelian", href: "/pembelian", icon: Wallet },
      ],
    });
  }

  if (ORDER_SPECIALIST_ROLES.includes(role)) {
    groups.push({
      title: "Order Specialist",
      icon: Globe,
      items: [{ label: "Approval Online", href: "/penjualan-online", icon: ClipboardCheck }],
    });
  }

  if (HEAD_BRANCH_ROLES.includes(role)) {
    groups.push({
      title: "Cabang",
      icon: Building2,
      items: [
        { label: "Approval Penjualan", href: "/cabang/approval-penjualan", icon: ClipboardCheck },
        { label: "Rekap Penjualan", href: "/sales", icon: Receipt },
      ],
    });
  }

  if (STOCK_ROLES.includes(role)) {
    groups.push({
      title: "Stok",
      icon: Warehouse,
      items: [
        { label: "Quality Control", href: "/stok/qc", icon: ClipboardCheck },
        { label: "Report Penjualan", href: "/stok/report-penjualan", icon: AlertCircle },
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

/** Gabung menu semua role user (tanpa pilih role): grup dedup per judul, item dedup per href. */
export function navForRoles(roles: RoleCode[]): NavGroup[] {
  const out: NavGroup[] = [];
  const byKey = new Map<string, NavGroup>();
  for (const role of roles) {
    for (const g of navForRole(role)) {
      const key = g.title ?? "__umum__";
      let grp = byKey.get(key);
      if (!grp) {
        grp = { title: g.title, icon: g.icon, items: [] };
        byKey.set(key, grp);
        out.push(grp);
      }
      for (const it of g.items) if (!grp.items.some((x) => x.href === it.href)) grp.items.push(it);
    }
  }
  return out;
}

/** Bottom nav HP gabungan: Beranda, maks 3 item unik, Profil (≤5). */
export function bottomNavForRoles(roles: RoleCode[]): NavItem[] {
  const seen = new Set<string>();
  const uniq = roles.flatMap(bottomNavForRole).filter((i) => (seen.has(i.href) ? false : (seen.add(i.href), true)));
  const beranda = uniq.find((i) => i.href === "/beranda");
  const profil = uniq.find((i) => i.href === "/profil");
  const mid = uniq.filter((i) => i.href !== "/beranda" && i.href !== "/profil").slice(0, 3);
  return [...(beranda ? [beranda] : []), ...mid, ...(profil ? [profil] : [])];
}

/** Bottom nav HP: 5 item. (PRD §6.1) */
export function bottomNavForRole(role: RoleCode): NavItem[] {
  const items: NavItem[] = [{ label: "Beranda", href: "/beranda", icon: Home }];
  if (role === "SALES") {
    // Sales HP: ganti Absen → Input Pembelian; plus Input Penjualan (akses cepat).
    items.push({ label: "Input Pembelian", href: "/pembelian", icon: Wallet });
    items.push({ label: "Input Penjualan", href: "/sales", icon: Receipt });
  } else {
    if (ABSEN_ON && roleAttends(role)) items.push({ label: "Absen", href: "/absen", icon: Clock });
    items.push({ label: "Pengajuan", href: "/pengajuan", icon: FileText });
  }
  items.push({ label: "Profil", href: "/profil", icon: User });
  return items; // Notifikasi via bell di header (hemat slot bottom nav)
}
