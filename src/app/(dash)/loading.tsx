import { AbstractCubeIsometricLoader } from "@/components/ui/abstract-cube-isometric-loader";

// Tampil saat pindah halaman (server component ambil data).
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-primary">
      <AbstractCubeIsometricLoader dotSize={6} gap={4} speed={1.2} bloom />
      <p className="text-sm text-muted-foreground">Memuat…</p>
    </div>
  );
}
