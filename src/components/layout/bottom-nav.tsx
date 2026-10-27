"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { bottomNavForRole } from "@/lib/nav";
import { useActiveRole } from "./active-role-context";

// Bottom nav HP: kapsul liquid-glass mengambang, ikon saja. (PRD §6.1)
export function BottomNav() {
  const pathname = usePathname();
  const { role } = useActiveRole();
  const items = bottomNavForRole(role);

  return (
    <nav className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 md:hidden">
      <div className="flex items-center gap-1 rounded-full border border-white/40 bg-white/70 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/60">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                "flex h-11 items-center justify-center gap-2 rounded-full px-3 transition-colors",
                active
                  ? "bg-background text-foreground shadow ring-2 ring-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {active && <span className="text-13 font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
