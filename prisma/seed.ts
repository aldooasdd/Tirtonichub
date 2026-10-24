import { PrismaClient, type RoleCode } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

// engineType "client" wajib driver adapter (sama seperti src/server/db.ts).
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ROLES: { code: RoleCode; name: string }[] = [
  { code: "BOSS", name: "Boss" },
  { code: "MEDIA", name: "Media" },
  { code: "FINANCE", name: "Finance" },
  { code: "STOCK_ROOM", name: "Stok Room" },
  { code: "HR", name: "Human Resource" },
  { code: "HEAD_BRANCH", name: "Head Branch" },
  { code: "SALES", name: "Sales" },
  { code: "ORDER_SPECIALIST", name: "Order Specialist" },
];

const BRANCHES = ["Tirtonic Jogja", "Tirtonic Solo", "Tirtonic Semarang"];

// 2 akun Boss (recovery) — §5.4. Override via env.
const BOSSES = [
  {
    email: process.env.SEED_BOSS1_EMAIL ?? "boss1@tirtonichub.com",
    name: process.env.SEED_BOSS1_NAME ?? "Boss Satu",
    wa: process.env.SEED_BOSS1_WA ?? "+628111111111",
  },
  {
    email: process.env.SEED_BOSS2_EMAIL ?? "boss2@tirtonichub.com",
    name: process.env.SEED_BOSS2_NAME ?? "Boss Dua",
    wa: process.env.SEED_BOSS2_WA ?? "+628222222222",
  },
];

async function main() {
  // Role
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name },
      create: r,
    });
  }

  // Cabang
  for (const name of BRANCHES) {
    await prisma.branch.upsert({ where: { name }, update: {}, create: { name } });
  }

  // Jadwal kerja default (untuk Fase 2)
  const regulerExists = await prisma.workSchedule.findFirst({
    where: { name: "Reguler 09:00–17:00" },
  });
  if (!regulerExists) {
    await prisma.workSchedule.create({
      data: {
        name: "Reguler 09:00–17:00",
        workDays: [1, 2, 3, 4, 5],
        startTime: "09:00",
        endTime: "17:00",
        lateToleranceMin: 10,
      },
    });
  }

  // 2 Boss + role BOSS
  const bossRole = await prisma.role.findUniqueOrThrow({ where: { code: "BOSS" } });
  for (const b of BOSSES) {
    const user = await prisma.user.upsert({
      where: { email: b.email },
      update: { fullName: b.name, waNumber: b.wa, isActive: true },
      create: { email: b.email, fullName: b.name, waNumber: b.wa },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: bossRole.id } },
      update: {},
      create: { userId: user.id, roleId: bossRole.id },
    });
  }

  console.log(
    `Seed OK: ${ROLES.length} role, ${BRANCHES.length} cabang, ${BOSSES.length} Boss.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
