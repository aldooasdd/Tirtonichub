"use client";

import { NavLink } from "./nav-link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navForRole } from "@/lib/nav";
import { useActiveRole } from "./active-role-context";
import { ScrollArea } from "@/components/ui/scroll-area";

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useActiveRole();
  const groups = navForRole(role);

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-ball.png" alt="Tirtonic" className="h-8 w-8 object-contain" />
        <span className="font-semibold">Tirtonichub</span>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-3 pb-4">
        {groups.map((group, i) => (
          <div key={i} className="mb-4">
            {group.title && (
              <p className="px-3 py-2 text-12 font-semibold text-muted-foreground">
                {group.title}
              </p>
            )}
            <nav className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    external={item.external}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-14 transition-colors",
                      active
                        ? "bg-accent font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}
      </ScrollArea>
    </aside>
  );
}
