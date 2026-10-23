import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
