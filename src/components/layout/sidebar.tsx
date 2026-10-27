"use client";

import { NavLink } from "./nav-link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { navForRole, type NavItem } from "@/lib/nav";
import { useActiveRole } from "./active-role-context";
import { ScrollArea } from "@/components/ui/scroll-area";

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useActiveRole();
  const groups = navForRole(role);
  // item aktif = href cocok DAN paling spesifik (prefix terpanjang), biar /finance tak ikut aktif di /finance/penjualan.
  const matches = (href: string) => pathname === href || pathname.startsWith(href + "/");
  let activeHref = "";
  for (const g of groups) for (const it of g.items) if (matches(it.href) && it.href.length > activeHref.length) activeHref = it.href;
  const isActive = (href: string) => href === activeHref;

  // grup role bisa dilipat; default terbuka. Key = judul grup.
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const toggle = (t: string) => setClosed((c) => ({ ...c, [t]: !c[t] }));

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-ball.png" alt="Tirtonic" className="h-8 w-8 object-contain" />
        <span className="font-semibold">Tirtonichub.</span>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-3 pb-4">
        {groups.map((group, i) => {
          // grup umum (tanpa judul): item + ikon seperti biasa.
          if (!group.title) {
            return (
              <nav key={i} className="mb-4 flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <ItemLink key={item.href} item={item} active={isActive(item.href)} withIcon />
                ))}
              </nav>
            );
          }
          // grup role: header ikon + chevron (bisa dilipat), item teks saja.
          const Icon = group.icon;
          const open = !closed[group.title] || group.items.some((it) => isActive(it.href));
          return (
            <div key={i} className="mb-2">
              <button
                onClick={() => toggle(group.title!)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-14 font-medium text-foreground transition-colors hover:bg-accent"
              >
                {Icon && <Icon className="h-[18px] w-[18px]" />}
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
        "px-3", // indent item role ditangani wadah (garis kiri)
        active ? "bg-accent font-semibold text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {withIcon && <Icon className="h-[18px] w-[18px]" />}
      {item.label}
    </NavLink>
  );
}
