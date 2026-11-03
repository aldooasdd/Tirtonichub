"use client";

import { useEffect, useState } from "react";
import { AbstractCubeIsometricLoader } from "@/components/ui/abstract-cube-isometric-loader";

const SHOW_AFTER_MS = 400; // proses cepat tak perlu kedip loader
const USER_WINDOW_MS = 15_000; // request ≤15 dtk setelah klik/ketik = dipicu user (bukan polling/heartbeat)
const MAX_MS = 180_000; // jaga-jaga request menggantung: overlay hilang sendiri

/** Overlay loading global: muncul selama ada proses simpan (server action / POST) yang dipicu user.
 *  ponytail: bungkus window.fetch sekali di root, tak perlu pasang loader di tiap form. */
export function GlobalBusy() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let lastInput = 0;
    let count = 0;
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let maxTimer: ReturnType<typeof setTimeout> | undefined;
    const mark = () => {
      lastInput = Date.now();
    };
    const events = ["pointerdown", "keydown", "change", "submit"] as const;
    for (const e of events) window.addEventListener(e, mark, true);

    const start = () => {
      if (count++ > 0) return;
      showTimer = setTimeout(() => setShow(true), SHOW_AFTER_MS);
      maxTimer = setTimeout(() => setShow(false), MAX_MS);
    };
    const end = () => {
      if (--count > 0) return;
      count = 0;
      clearTimeout(showTimer);
      clearTimeout(maxTimer);
      setShow(false);
    };

    const orig = window.fetch;
    const shouldTrack = (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const req = input instanceof Request ? input : null;
        const method = (init?.method ?? req?.method ?? "GET").toUpperCase();
        const url = req ? req.url : String(input);
        return (
          method !== "GET" &&
          method !== "HEAD" &&
          new URL(url, location.href).origin === location.origin &&
          Date.now() - lastInput < USER_WINDOW_MS
        );
      } catch {
        return false; // apa pun yang aneh: jangan ganggu request
      }
    };
    window.fetch = async (input, init) => {
      const track = shouldTrack(input, init);
      if (!track) return orig(input, init);
      start();
      try {
        return await orig(input, init);
      } finally {
        end();
      }
    };

    return () => {
      window.fetch = orig;
      for (const e of events) window.removeEventListener(e, mark, true);
      clearTimeout(showTimer);
      clearTimeout(maxTimer);
    };
  }, []);

  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background/70 text-primary backdrop-blur-sm"
      aria-live="polite"
    >
      <AbstractCubeIsometricLoader dotSize={8} gap={5} speed={1.2} bloom />
      <p className="text-14 font-medium text-foreground">Sedang diproses… jangan tutup halaman</p>
    </div>
  );
}
