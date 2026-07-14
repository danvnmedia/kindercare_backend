import { PrismaClient } from "@prisma/client";
import { SYSTEM_PERMISSIONS } from "../src/application/rbac/use-cases/seed-permissions.use-case";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Seed Campuses (UUIDs must be valid v4 format: 4xxx in 3rd group, 8/9/a/b in 4th group)
  const campuses = await Promise.all([
    prisma.campus.upsert({
      where: { id: "11111111-1111-4111-8111-111111111111" },
      update: { name: "Kindercare Mỹ Đình" },
      create: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Kindercare Mỹ Đình",
        address: "My Dinh, Ha Noi",
        isArchived: false,
      },
    }),
    prisma.campus.upsert({
      where: { id: "22222222-2222-4222-8222-222222222222" },
      update: { name: "Kindercare Nam Đô" },
      create: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Kindercare Nam Đô",
        address: "Quan 2, Ho Chi Minh",
        isArchived: false,
      },
    }),
    prisma.campus.upsert({
      where: { id: "33333333-3333-4333-8333-333333333333" },
      update: { name: "Kindercare Bắc Giang" },
      create: {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Kindercare Bắc Giang",
        address: "Nam Do, Ha Noi",
        isArchived: false,
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
    where: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    update: {
      isSystemRole: true,
      isSystemDefault: true,
    },
    create: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Super Admin",
      description:
        "Global system administrator with full access to all campuses",
      campusId: null, // Global role (not campus-scoped)
      isSystemDefault: true, // Cannot be modified
      isSystemRole: true, // Grants global admin bypass
    },
  });

  console.log(`Created Super Admin role:`);
  console.log(`  - ${superAdminRole.name} (${superAdminRole.id})`);
  console.log(`    isSystemRole: ${superAdminRole.isSystemRole}`);
  console.log(`    isSystemDefault: ${superAdminRole.isSystemDefault}`);

  // Seed system permissions and grant Super Admin every permission.
  // This keeps local/dev bootstrap aligned with the RBAC permission catalog.
  const permissions = await Promise.all(
    SYSTEM_PERMISSIONS.map((permission) =>
      prisma.permission.upsert({
        where: { id: permission.id },
        update: {
          module: permission.module,
          description: permission.description,
        },
        create: permission,
      }),
    ),
  );

  const rolePermissionResult = await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({
      roleId: superAdminRole.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  console.log(`Seeded ${permissions.length} permissions.`);
  console.log(
    `Assigned ${rolePermissionResult.count} new permissions to Super Admin.`,
  );

  const superAdminClerkUid = process.env.SEED_SUPER_ADMIN_CLERK_UID;
  if (superAdminClerkUid) {
    const adminUser = await prisma.user.upsert({
      where: { clerkUid: superAdminClerkUid },
      update: { isActive: true },
      create: {
        clerkUid: superAdminClerkUid,
        isActive: true,
      },
    });

    await prisma.userRole.createMany({
      data: [
        {
          userId: adminUser.id,
          roleId: superAdminRole.id,
          campusId: null,
          grantedViaStaffTypeId: null,
        },
      ],
      skipDuplicates: true,
    });

    console.log(
      `Seeded Super Admin user assignment for Clerk UID: ${superAdminClerkUid}`,
    );
  } else {
    console.log(
      "Skipped Super Admin user assignment (SEED_SUPER_ADMIN_CLERK_UID not set).",
    );
  }

  console.log("Seeding completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
