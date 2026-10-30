import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build lokal, .next di-commit (host cPanel OOM saat build). server.js (custom) sajikan .next.
  // App ini full ber-auth (baca cookies tiap request) → dinamis; Cache Components tak membantu.
  // UI Tirtonic Studio (statis di public/studio) disajikan di /studio; data lewat /api/studio.
  // Scan nota kirim file asli + strip JPEG resolusi tinggi (±2MB/halaman). Default 1MB terlalu kecil.
  experimental: {
    serverActions: { bodySizeLimit: "30mb" },
  },
  async rewrites() {
    return [{ source: "/studio", destination: "/studio/index.html" }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
