"use client";

import { usePathname, useRouter } from "next/navigation";
import { bottomNavForRoles } from "@/lib/nav";
import { useActiveRole } from "./active-role-context";

// Bottom nav HP: kapsul liquid-glass (CSS displacement filter + pill geser).
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { roles } = useActiveRole();
  const items = bottomNavForRoles(roles);

  // index aktif = prefix terpanjang yang cocok.
  let activeIdx = 0;
  let best = -1;
  items.forEach((it, i) => {
    if ((pathname === it.href || pathname.startsWith(it.href + "/")) && it.href.length > best) {
      best = it.href.length;
      activeIdx = i;
    }
  });

  const col = 100 / items.length;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] md:hidden">
      <div className="relative flex rounded-full border border-white/15 bg-background/70 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        {/* overlay distorsi kaca */}
        <div
          className="pointer-events-none absolute inset-0 isolate -z-0 overflow-hidden rounded-full"
          style={{ filter: 'url("#radio-glass")' }}
        />
        {/* pill geser di belakang item aktif */}
        <div
          className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-background/80 shadow-[0_0_6px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3px_rgba(0,0,0,0.9),inset_-3px_-3px_0.5px_-3px_rgba(0,0,0,0.85),inset_1px_1px_1px_-0.5px_rgba(0,0,0,0.6),inset_-1px_-1px_1px_-0.5px_rgba(0,0,0,0.6),inset_0_0_6px_6px_rgba(0,0,0,0.12),inset_0_0_2px_2px_rgba(0,0,0,0.06),0_0_12px_rgba(255,255,255,0.15)] transition-[left] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] dark:shadow-[0_0_8px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3.5px_rgba(255,255,255,0.09),inset_-3px_-3px_0.5px_-3.5px_rgba(255,255,255,0.85),inset_1px_1px_1px_-0.5px_rgba(255,255,255,0.6),inset_-1px_-1px_1px_-0.5px_rgba(255,255,255,0.6),inset_0_0_6px_6px_rgba(255,255,255,0.12),inset_0_0_2px_2px_rgba(255,255,255,0.06),0_0_12px_rgba(0,0,0,0.15)]"
          style={{ left: `calc(${activeIdx * col}% + 4px)`, width: `calc(${col}% - 8px)` }}
        />
        {items.map((it, i) => {
          const Icon = it.icon;
          const active = i === activeIdx;
          return (
            <button
              key={it.href}
              onClick={() => router.push(it.href)}
              className={`relative z-10 flex flex-1 select-none flex-col items-center gap-0.5 py-2 text-[11px] transition-colors ${
                active ? "text-foreground" : "text-muted-foreground/70"
              }`}
            >
              <Icon size={18} strokeWidth={1.8} />
              {it.label}
            </button>
          );
        })}
        <GlassFilter />
      </div>
    </div>
  );
}

function GlassFilter() {
  return (
    <svg className="hidden">
      <defs>
        <filter id="radio-glass" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves="1" seed="1" result="turbulence" />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
          <feDisplacementMap in="SourceGraphic" in2="blurredNoise" scale="30" xChannelSelector="R" yChannelSelector="B" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation="2" result="finalBlur" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}
