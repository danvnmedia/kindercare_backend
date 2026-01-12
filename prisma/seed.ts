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

  // Seed Super Admin Role (global role with isSystemRole=true for admin bypass)
  // UUID follows same pattern as campuses: valid v4 format
  const superAdminRole = await prisma.role.upsert({
    where: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    update: {
      isSystemRole: true,
      isSystemDefault: true,
    },
    create: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Super Admin',
      description: 'Global system administrator with full access to all campuses',
      campusId: null, // Global role (not campus-scoped)
      isSystemDefault: true, // Cannot be modified
      isSystemRole: true, // Grants global admin bypass
      permissions: {},
    },
  });

  console.log(`Created Super Admin role:`);
  console.log(`  - ${superAdminRole.name} (${superAdminRole.id})`);
  console.log(`    isSystemRole: ${superAdminRole.isSystemRole}`);
  console.log(`    isSystemDefault: ${superAdminRole.isSystemDefault}`);

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
