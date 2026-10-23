import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build lokal, .next di-commit (host cPanel OOM saat build). server.js (custom) sajikan .next.
  // App ini full ber-auth (baca cookies tiap request) → dinamis; Cache Components tak membantu.
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
