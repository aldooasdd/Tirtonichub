// Halaman tertanam di Tirtonic Studio (iframe /studio → /e/...): tanpa menu dasbor Tirtonichub.
// Izin tetap dicek di setiap halaman (requireMedia / server action).
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#F7F8FA]">{children}</div>;
}
