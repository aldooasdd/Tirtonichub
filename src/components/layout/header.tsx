"use client";

import Link from "next/link";
import { useState } from "react";
import { NavLink } from "./nav-link";
import { usePathname } from "next/navigation";
import { Bell, Menu, LogOut, User, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { avatarColor } from "@/lib/avatar-color";
import { navForRoles, GROUP_COLOR } from "@/lib/nav";
import { useActiveRole, useSessionUser } from "./active-role-context";
import { RoleSwitcher } from "./role-switcher";
import { ThemeToggle } from "./theme-toggle";
import { logoutAction } from "@/server/actions/auth";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

export function Header() {
  const pathname = usePathname();
  const { roles } = useActiveRole();
  const user = useSessionUser();
  const groups = navForRoles(roles);
  const umum = groups.find((g) => !g.title);
  const roleGroups = groups.filter((g) => g.title);
  // item aktif = prefix terpanjang (sama dgn sidebar).
  const matches = (href: string) => pathname === href || pathname.startsWith(href + "/");
  let activeHref = "";
  for (const g of groups) for (const it of g.items) if (matches(it.href) && it.href.length > activeHref.length) activeHref = it.href;
  const isActive = (href: string) => href === activeHref;
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const toggle = (t: string) => setClosed((c) => ({ ...c, [t]: !c[t] }));
  const linkCls = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-md px-3 py-2 text-14 transition-colors",
      active ? "bg-accent font-semibold text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
    );

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 md:px-6">
      {/* mobile: buka menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 overflow-y-auto p-0">
          <SheetTitle className="px-6 pt-6">Menu</SheetTitle>
          <div className="p-3">
            {umum && (
              <nav className="mb-2 flex flex-col gap-0.5">
                {umum.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink key={item.href} href={item.href} external={item.external} className={linkCls(isActive(item.href))}>
                      <Icon className="h-[18px] w-[18px]" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>
            )}
            {roleGroups.map((group, i) => {
              const Icon = group.icon;
              const open = !closed[group.title!] || group.items.some((it) => isActive(it.href));
              return (
                <div key={i} className="mb-2">
                  <button
                    onClick={() => toggle(group.title!)}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-14 font-medium transition-colors hover:bg-accent"
                  >
                    {Icon && <Icon className={cn("h-[18px] w-[18px]", GROUP_COLOR[group.title!])} />}
                    <span className="flex-1 text-left">{group.title}</span>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
                  </button>
                  {open && (
                    <nav className="ml-[21px] mt-0.5 flex flex-col gap-0.5 border-l pl-2">
                      {group.items.map((item) => (
                        <NavLink key={item.href} href={item.href} external={item.external} className={linkCls(isActive(item.href))}>
                          {item.label}
                        </NavLink>
                      ))}
                    </nav>
                  )}
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <div className="ml-auto flex items-center gap-1">
        {/* desktop: role/notif/akun pindah ke footer sidebar → ini mobile saja */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <RoleSwitcher />
          <Button asChild variant="ghost" size="icon" aria-label="Notifikasi">
            <Link href="/notifikasi">
              <Bell className="h-5 w-5" />
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Akun" className="ml-1">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className={cn("font-semibold", avatarColor(user.fullName))}>{initials(user.fullName)}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{user.fullName}</span>
                  <span className="text-12 font-normal text-muted-foreground">{user.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profil">
                  <User className="h-4 w-4" /> Profil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logoutAction()}>
                <LogOut className="h-4 w-4" /> Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
