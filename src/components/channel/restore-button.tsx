"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { restoreProduct } from "@/server/actions/produk-master";

export function RestoreButton({ platform, itemId }: { platform: string; itemId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void ((await restoreProduct(platform, itemId)).ok && router.refresh()))}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-14 font-medium text-emerald-600 disabled:opacity-40"
    >
      <RotateCcw className="size-4" /> Pulihkan
    </button>
  );
}
