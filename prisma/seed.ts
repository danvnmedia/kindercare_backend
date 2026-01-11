import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Seed Campuses (UUIDs must be valid v4 format: 4xxx in 3rd group, 8/9/a/b in 4th group)
  const campuses = await Promise.all([
    prisma.campus.upsert({
      where: { id: '11111111-1111-4111-8111-111111111111' },
      update: {},
      create: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Kindercare My Dinh',
        address: 'My Dinh, Ha Noi',
        isActive: true,
      },
    }),
    prisma.campus.upsert({
      where: { id: '22222222-2222-4222-8222-222222222222' },
      update: {},
      create: {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Kindercare Quan 2',
        address: 'Quan 2, Ho Chi Minh',
        isActive: true,
      },
    }),
    prisma.campus.upsert({
      where: { id: '33333333-3333-4333-8333-333333333333' },
      update: {},
      create: {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Kindercare Nam Do',
        address: 'Nam Do, Ha Noi',
        isActive: true,
      },
    }),
  ]);

  console.log(`Created ${campuses.length} campuses:`);
  campuses.forEach((campus) => {
    console.log(`  - ${campus.name} (${campus.id})`);
  });

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
