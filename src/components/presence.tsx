"use client";

import { useEffect } from "react";
import { heartbeat } from "@/server/actions/presence";

// Ping lastActiveAt tiap 60 dtk selama tab terlihat → status online akurat.
export function Presence() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === "visible") void heartbeat();
    };
    ping();
    const t = setInterval(ping, 60_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);
  return null;
}
