"use client";

import Link from "next/link";
import { NavLink } from "./nav-link";
import { usePathname } from "next/navigation";
import { Bell, Menu, LogOut, User } from "lucide-react";
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
import { navForRole } from "@/lib/nav";
import { useActiveRole, useSessionUser } from "./active-role-context";
import { RoleSwitcher } from "./role-switcher";
import { ThemeToggle } from "./theme-toggle";
import { logoutAction } from "@/server/actions/auth";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

export function Header() {
  const pathname = usePathname();
  const { role } = useActiveRole();
  const user = useSessionUser();
  const groups = navForRole(role);

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 md:px-6">
      {/* mobile: buka menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="px-6 pt-6">Menu</SheetTitle>
          <nav className="flex flex-col gap-0.5 p-3">
            {groups.flatMap((g) =>
              g.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    external={item.external}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-14",
                      active
                        ? "bg-accent font-semibold"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {item.label}
                  </NavLink>
                );
              }),
            )}
          </nav>
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
                  <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
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
