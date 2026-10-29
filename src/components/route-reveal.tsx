"use client";

import { usePathname } from "next/navigation";

/** Animasi masuk tiap buka/pindah halaman. key=pathname → remount → .reveal replay. */
export function RouteReveal({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="reveal">
      {children}
    </div>
  );
}
