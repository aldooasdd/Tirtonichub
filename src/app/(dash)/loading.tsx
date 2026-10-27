// Tampil instan saat pindah halaman (sementara server component ambil data).
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-48 animate-pulse rounded bg-muted" />
      <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      <div className="h-36 animate-pulse rounded-lg bg-muted" />
      <div className="h-36 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
