"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { bottomNavForRole } from "@/lib/nav";
import { useActiveRole } from "./active-role-context";
import { LiquidNavbar } from "@/components/ui/liquid-glass-navbar";

// Bottom nav HP: kapsul air liquid-glass (Nimbus), full-width mentok tepi.
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { role } = useActiveRole();
  const { resolvedTheme } = useTheme();
  const items = bottomNavForRole(role);

  // index aktif = prefix terpanjang yang cocok.
  let activeIdx = 0;
  let best = -1;
  items.forEach((it, i) => {
    if ((pathname === it.href || pathname.startsWith(it.href + "/")) && it.href.length > best) {
      best = it.href.length;
      activeIdx = i;
    }
  });

  const navItems = items.map((it) => {
    const Icon = it.icon;
    return { label: it.label, icon: <Icon size={18} strokeWidth={1.8} /> };
  });

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex md:hidden">
      <LiquidNavbar
        className="bottom-liquid"
        items={navItems}
        active={activeIdx}
        onChange={(i) => router.push(items[i].href)}
        tone={resolvedTheme === "dark" ? "dark" : "light"}
        compact={false}
      />
    </div>
  );
}
