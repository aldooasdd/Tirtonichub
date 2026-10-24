# Build + run Next.js di PC (Docker). Mesin beneran → build di sini, bukan di-commit.
FROM node:20-slim

# openssl: dibutuhkan beberapa tooling. corepack: pnpm.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /app

# Install deps dulu (layer cache). Postinstall @prisma/client generate jalan di sini — aman, RAM cukup.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Sisa source + build.
COPY . .
RUN pnpm build

ENV NODE_ENV=production
EXPOSE 3000
# next start menyajikan .next hasil build (bukan standalone). Bind 0.0.0.0 default.
CMD ["pnpm", "start"]
