"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, PanelRight, Search, Settings, LogOut, User } from "lucide-react";
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
import { useActiveRole } from "./active-role-context";
import { ThemeToggle } from "./theme-toggle";
import { RoleSwitcher } from "./role-switcher";

export function Header({ onTogglePanel }: { onTogglePanel: () => void }) {
  const pathname = usePathname();
  const { role } = useActiveRole();
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
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-14",
                      active
                        ? "bg-accent font-semibold"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {item.label}
                  </Link>
                );
              }),
            )}
          </nav>
        </SheetContent>
      </Sheet>

      {/* search (placeholder) */}
      <div className="hidden items-center gap-2 rounded-md bg-muted px-3 py-2 text-muted-foreground sm:flex">
        <Search className="h-4 w-4" />
        <span className="text-14">Cari…</span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <RoleSwitcher />
        <ThemeToggle />
        <Button variant="ghost" size="icon" aria-label="Notifikasi">
          <Bell className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Panel kanan"
          className="hidden lg:inline-flex"
          onClick={onTogglePanel}
        >
          <PanelRight className="h-5 w-5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Akun" className="ml-1">
              <Avatar className="h-8 w-8">
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Akun</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profil">
                <User className="h-4 w-4" /> Profil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Settings className="h-4 w-4" /> Pengaturan
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <LogOut className="h-4 w-4" /> Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
