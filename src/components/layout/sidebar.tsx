"use client";

import { NavLink } from "./nav-link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut, Bell, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { navForRoles, GROUP_COLOR, type NavItem } from "@/lib/nav";
import { useActiveRole, useSessionUser } from "./active-role-context";
import { logoutAction } from "@/server/actions/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { avatarColor } from "@/lib/avatar-color";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RightNotif } from "./right-panel";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}


export function Sidebar({ notifCount, notifications }: { notifCount: number; notifications: RightNotif[] }) {
  const pathname = usePathname();
  const { roles } = useActiveRole();
  const user = useSessionUser();
  const groups = navForRoles(roles);
  // item aktif = href cocok DAN paling spesifik (prefix terpanjang).
  const matches = (href: string) => pathname === href || pathname.startsWith(href + "/");
  let activeHref = "";
  for (const g of groups) for (const it of g.items) if (matches(it.href) && it.href.length > activeHref.length) activeHref = it.href;
  const isActive = (href: string) => href === activeHref;

  const umum = groups.find((g) => !g.title); // fitur umum → pindah ke footer
  const roleGroups = groups.filter((g) => g.title);

  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const toggle = (t: string) => setClosed((c) => ({ ...c, [t]: !c[t] }));
  const [menuOpen, setMenuOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Auto-close popup akun saat klik di luar footer.
  const footerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (footerRef.current && !footerRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  return (
    <aside className="hidden w-64 shrink-0 md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-ball.png" alt="Tirtonic" className="h-8 w-8 object-contain dark:invert" />
        <span className="font-semibold">Tirtonichub.</span>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-3 pb-2">
        {roleGroups.map((group, i) => {
          const Icon = group.icon;
          const open = !closed[group.title!] || group.items.some((it) => isActive(it.href));
          return (
            <div key={i} className="mb-2">
              <button
                onClick={() => toggle(group.title!)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-14 font-medium text-foreground transition-colors hover:bg-accent"
              >
                {Icon && <Icon className={cn("h-[18px] w-[18px]", GROUP_COLOR[group.title!])} />}
                <span className="flex-1 text-left">{group.title}</span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
              </button>
              {open && (
                <nav className="ml-[21px] mt-0.5 flex flex-col gap-0.5 border-l pl-2">
                  {group.items.map((item) => (
                    <ItemLink key={item.href} item={item} active={isActive(item.href)} />
                  ))}
                </nav>
              )}
            </div>
          );
        })}
      </ScrollArea>

      {/* Footer: kapsul akun terbang (klik kapsul → buka fitur umum) */}
      <div ref={footerRef} className="p-3">
        {menuOpen && umum && (
          <nav
            onClick={() => setMenuOpen(false)}
            className="mb-2 flex flex-col gap-0.5 rounded-2xl border bg-card p-2 shadow-lg"
          >
            {umum.items.map((item) => (
              <ItemLink key={item.href} item={item} active={isActive(item.href)} withIcon />
            ))}
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-14 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
              {isDark ? "Mode terang" : "Mode gelap"}
            </button>
            <button
              onClick={() => logoutAction()}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-14 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-[18px] w-[18px]" /> Keluar
            </button>
          </nav>
        )}
        <div className="flex items-center gap-2 rounded-2xl border bg-card px-2 py-2 shadow-lg">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setMenuOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setMenuOpen((v) => !v);
              }
            }}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl transition-colors hover:bg-accent/50"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className={cn("font-semibold", avatarColor(user.fullName))}>{initials(user.fullName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-14 font-medium">{user.fullName}</span>
              </div>
              <p className="truncate text-12 text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Notifikasi"
                className="relative shrink-0 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Bell className="h-[18px] w-[18px]" />
                {notifCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                    {notifCount > 99 ? "99+" : notifCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-80">
              <DropdownMenuLabel>Notifikasi</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <p className="px-2 py-4 text-center text-14 text-muted-foreground">Belum ada notifikasi.</p>
              ) : (
                notifications.map((n) => (
                  <DropdownMenuItem key={n.id} asChild>
                    <NavLink href={n.link ?? "/notifikasi"} className="flex flex-col items-start gap-0.5">
                      <span className="line-clamp-2 text-14">{n.title}</span>
                      <span className="text-12 text-muted-foreground">{n.time}</span>
                    </NavLink>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <NavLink href="/notifikasi" className="justify-center text-14 font-medium">
                  Lihat semua
                </NavLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  );
}

function ItemLink({ item, active, withIcon }: { item: NavItem; active: boolean; withIcon?: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      href={item.href}
      external={item.external}
      className={cn(
        "flex items-center gap-3 rounded-md py-2 text-14 transition-colors",
        "px-3",
        active ? "bg-accent font-semibold text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {withIcon && <Icon className="h-[18px] w-[18px]" />}
      {item.label}
    </NavLink>
  );
}
