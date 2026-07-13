import { PrismaClient } from "@prisma/client";
import { fixtureId, getSeedCampusId, runSeedCli } from "./seed-support";
import { readSeedStudents, studentFixtureId } from "./seed-students";

export const GUARDIAN_RELATIONSHIP_NAMES = [
  "Ông",
  "Bà",
  "Bố",
  "Mẹ",
  "Anh",
  "Chị",
  "Cô",
  "Dì",
  "Chú",
  "Bác",
] as const;

export type GuardianRelationshipName =
  (typeof GUARDIAN_RELATIONSHIP_NAMES)[number];

export interface GuardianFixture {
  seedKey: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  gender: "MALE" | "FEMALE";
  isArchived: boolean;
  linkConfiguredParentIdentity?: boolean;
}

export const GUARDIAN_FIXTURES: readonly GuardianFixture[] = [
  {
    seedKey: "guardian-001",
    fullName: "Nguyễn Văn Minh",
    email: "guardian01+clerk_test@example.com",
    phoneNumber: "+15555550100",
    gender: "MALE",
    isArchived: false,
    linkConfiguredParentIdentity: true,
  },
  {
    seedKey: "guardian-002",
    fullName: "Trần Thu Hà",
    email: "guardian02+clerk_test@example.com",
    phoneNumber: "+15555550101",
    gender: "FEMALE",
    isArchived: false,
  },
  {
    seedKey: "guardian-003",
    fullName: "Lê Quốc Anh",
    email: "guardian03+clerk_test@example.com",
    phoneNumber: "+15555550102",
    gender: "MALE",
    isArchived: false,
  },
  {
    seedKey: "guardian-004",
    fullName: "Phạm Ngọc Lan",
    email: "guardian04+clerk_test@example.com",
    phoneNumber: "+15555550103",
    gender: "FEMALE",
    isArchived: false,
  },
  {
    seedKey: "guardian-005",
    fullName: "Đỗ Thị Hương",
    email: "guardian05+clerk_test@example.com",
    phoneNumber: "+15555550104",
    gender: "FEMALE",
    isArchived: false,
  },
  {
    seedKey: "guardian-006",
    fullName: "Vũ Hoàng Nam",
    email: "guardian06+clerk_test@example.com",
    phoneNumber: "+15555550105",
    gender: "MALE",
    isArchived: false,
  },
  {
    seedKey: "guardian-007",
    fullName: "Bùi Thanh Mai",
    email: "guardian07+clerk_test@example.com",
    phoneNumber: "+15555550106",
    gender: "FEMALE",
    isArchived: false,
  },
  {
    seedKey: "guardian-008",
    fullName: "Nguyễn Đức Thành",
    email: "guardian08+clerk_test@example.com",
    phoneNumber: "+15555550107",
    gender: "MALE",
    isArchived: false,
  },
  {
    seedKey: "guardian-009",
    fullName: "Nguyễn Thị Lý",
    email: "guardian09+clerk_test@example.com",
    phoneNumber: "+15555550108",
    gender: "FEMALE",
    isArchived: false,
  },
  {
    seedKey: "guardian-010",
    fullName: "Hoàng Minh Châu",
    email: "guardian10+clerk_test@example.com",
    phoneNumber: "+15555550109",
    gender: "FEMALE",
    isArchived: false,
  },
  {
    seedKey: "guardian-011",
    fullName: "Phan Hải Đăng",
    email: "guardian11+clerk_test@example.com",
    phoneNumber: "+15555550110",
    gender: "MALE",
    isArchived: false,
  },
  {
    seedKey: "guardian-012",
    fullName: "Phan Thu Trang",
    email: "guardian12+clerk_test@example.com",
    phoneNumber: "+15555550111",
    gender: "FEMALE",
    isArchived: false,
  },
  {
    seedKey: "guardian-013",
    fullName: "Cao Thị Hạnh",
    email: "guardian13+clerk_test@example.com",
    phoneNumber: "+15555550112",
    gender: "FEMALE",
    isArchived: false,
  },
  {
    seedKey: "guardian-014",
    fullName: "Cao Văn Dũng",
    email: "guardian14+clerk_test@example.com",
    phoneNumber: "+15555550113",
    gender: "MALE",
    isArchived: false,
  },
  {
    seedKey: "guardian-015",
    fullName: "Đặng Văn Bình",
    email: "guardian15+clerk_test@example.com",
    phoneNumber: "+15555550114",
    gender: "MALE",
    isArchived: true,
  },
];

export interface GuardianStudentLinkFixture {
  guardianSeedKey: string;
  studentSeedKey: string;
  relationship: GuardianRelationshipName;
}

export const GUARDIAN_STUDENT_LINKS: readonly GuardianStudentLinkFixture[] = [
  {
    guardianSeedKey: "guardian-001",
    studentSeedKey: "student-025",
    relationship: "Bố",
  },
  {
    guardianSeedKey: "guardian-002",
    studentSeedKey: "student-025",
    relationship: "Mẹ",
  },
  {
    guardianSeedKey: "guardian-003",
    studentSeedKey: "student-026",
    relationship: "Bố",
  },
  {
    guardianSeedKey: "guardian-004",
    studentSeedKey: "student-026",
    relationship: "Mẹ",
  },
  {
    guardianSeedKey: "guardian-003",
    studentSeedKey: "student-027",
    relationship: "Bố",
  },
  {
    guardianSeedKey: "guardian-004",
    studentSeedKey: "student-027",
    relationship: "Mẹ",
  },
  {
    guardianSeedKey: "guardian-005",
    studentSeedKey: "student-028",
    relationship: "Bà",
  },
  {
    guardianSeedKey: "guardian-006",
    studentSeedKey: "student-029",
    relationship: "Bố",
  },
  {
    guardianSeedKey: "guardian-007",
    studentSeedKey: "student-029",
    relationship: "Mẹ",
  },
  {
    guardianSeedKey: "guardian-006",
    studentSeedKey: "student-030",
    relationship: "Bố",
  },
  {
    guardianSeedKey: "guardian-007",
    studentSeedKey: "student-030",
    relationship: "Mẹ",
  },
  {
    guardianSeedKey: "guardian-006",
    studentSeedKey: "student-031",
    relationship: "Bố",
  },
  {
    guardianSeedKey: "guardian-007",
    studentSeedKey: "student-031",
    relationship: "Mẹ",
  },
  {
    guardianSeedKey: "guardian-008",
    studentSeedKey: "student-032",
    relationship: "Ông",
  },
  {
    guardianSeedKey: "guardian-009",
    studentSeedKey: "student-032",
    relationship: "Bà",
  },
  {
    guardianSeedKey: "guardian-010",
    studentSeedKey: "student-033",
    relationship: "Cô",
  },
  {
    guardianSeedKey: "guardian-011",
    studentSeedKey: "student-034",
    relationship: "Anh",
  },
  {
    guardianSeedKey: "guardian-012",
    studentSeedKey: "student-034",
    relationship: "Chị",
  },
  {
    guardianSeedKey: "guardian-013",
    studentSeedKey: "student-035",
    relationship: "Dì",
  },
  {
    guardianSeedKey: "guardian-014",
    studentSeedKey: "student-035",
    relationship: "Chú",
  },
  {
    guardianSeedKey: "guardian-015",
    studentSeedKey: "student-036",
    relationship: "Bác",
  },
];

export interface SeedGuardiansOptions {
  campusId?: string;
  parentClerkUid?: string;
}

async function seedRelationshipTypes(
  prisma: PrismaClient,
  campusId: string,
): Promise<Map<GuardianRelationshipName, string>> {
  const occupiedOrders = await prisma.guardianRelationship.findMany({
    where: {
      campusId,
      order: { in: GUARDIAN_RELATIONSHIP_NAMES.map((_, index) => index + 1) },
      name: { notIn: [...GUARDIAN_RELATIONSHIP_NAMES] },
    },
    select: { name: true, order: true },
  });

  if (occupiedOrders.length > 0) {
    const conflicts = occupiedOrders
      .map((item) => `${item.order}:${item.name}`)
      .join(", ");
    throw new Error(
      `Cannot seed guardian relationship order because non-fixture rows occupy required positions: ${conflicts}.`,
    );
  }

  const seeded = new Map<GuardianRelationshipName, string>();

  for (const [index, name] of GUARDIAN_RELATIONSHIP_NAMES.entries()) {
    const relationship = await prisma.guardianRelationship.upsert({
      where: { campusId_name: { campusId, name } },
      create: {
        id: fixtureId(campusId, "guardian-relationship", name),
        campusId,
        name,
        description: `Optional development seed relationship: ${name}`,
        order: 1001 + index,
        isArchived: false,
      },
      update: {
        description: `Optional development seed relationship: ${name}`,
        order: 1001 + index,
        isArchived: false,
      },
    });
    seeded.set(name, relationship.id);
  }

  for (const [index, name] of GUARDIAN_RELATIONSHIP_NAMES.entries()) {
    await prisma.guardianRelationship.update({
      where: { campusId_name: { campusId, name } },
      data: { order: index + 1 },
    });
  }

  return seeded;
}

async function seedConfiguredParentUser(
  prisma: PrismaClient,
  campusId: string,
  clerkUid?: string,
): Promise<string | null> {
  const normalizedClerkUid = clerkUid?.trim();
  if (!normalizedClerkUid) return null;

  const fixtureUserId = fixtureId(campusId, "user", "configured-seed-parent");
  const existing = await prisma.user.findUnique({
    where: { clerkUid: normalizedClerkUid },
  });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { isActive: true },
    });
    return existing.id;
  }

  const existingFixtureUser = await prisma.user.findUnique({
    where: { id: fixtureUserId },
  });
  if (existingFixtureUser) {
    const updated = await prisma.user.update({
      where: { id: fixtureUserId },
      data: { clerkUid: normalizedClerkUid, isActive: true },
    });
    return updated.id;
  }

  const user = await prisma.user.create({
    data: {
      id: fixtureUserId,
      clerkUid: normalizedClerkUid,
      isActive: true,
    },
  });
  return user.id;
}

export async function seedGuardians(
  prisma: PrismaClient,
  options: SeedGuardiansOptions = {},
) {
  const campusId = options.campusId ?? getSeedCampusId();
  const campus = await prisma.campus.findUnique({
    where: { id: campusId },
    select: { id: true, name: true },
  });
  if (!campus) {
    throw new Error(
      `Campus ${campusId} not found. Run "npx prisma db seed" first.`,
    );
  }

  const studentSeedKeys = new Set(
    readSeedStudents().map(({ seedKey }) => seedKey),
  );
  for (const link of GUARDIAN_STUDENT_LINKS) {
    if (!studentSeedKeys.has(link.studentSeedKey)) {
      throw new Error(
        `Guardian link references unknown student seed key ${link.studentSeedKey}.`,
      );
    }
  }

  const relationshipIds = await seedRelationshipTypes(prisma, campusId);
  const configuredParentUserId = await seedConfiguredParentUser(
    prisma,
    campusId,
    options.parentClerkUid ?? process.env.SEED_PARENT_CLERK_UID,
  );
  const guardianIds = new Map<string, string>();

  for (const guardian of GUARDIAN_FIXTURES) {
    const id = fixtureId(campusId, "guardian", guardian.seedKey);
    const userId = guardian.linkConfiguredParentIdentity
      ? configuredParentUserId
      : null;
    await prisma.guardian.upsert({
      where: { id },
      create: {
        id,
        campusId,
        fullName: guardian.fullName,
        email: guardian.email,
        phoneNumber: guardian.phoneNumber,
        gender: guardian.gender,
        isArchived: guardian.isArchived,
        userId,
      },
      update: {
        campusId,
        fullName: guardian.fullName,
        email: guardian.email,
        phoneNumber: guardian.phoneNumber,
        gender: guardian.gender,
        isArchived: guardian.isArchived,
        ...(userId ? { userId } : {}),
      },
    });
    guardianIds.set(guardian.seedKey, id);
  }

  const desiredPairs = new Set(
    GUARDIAN_STUDENT_LINKS.map((link) => {
      const guardianId = guardianIds.get(link.guardianSeedKey);
      const studentId = studentFixtureId(campusId, link.studentSeedKey);
      return `${studentId}:${guardianId}`;
    }),
  );
  const existingLinks = await prisma.guardianStudent.findMany({
    where: { guardianId: { in: [...guardianIds.values()] } },
    select: { studentId: true, guardianId: true },
  });

  for (const existingLink of existingLinks) {
    if (
      !desiredPairs.has(`${existingLink.studentId}:${existingLink.guardianId}`)
    ) {
      await prisma.guardianStudent.delete({
        where: {
          studentId_guardianId: {
            studentId: existingLink.studentId,
            guardianId: existingLink.guardianId,
          },
        },
      });
    }
  }

  for (const link of GUARDIAN_STUDENT_LINKS) {
    const guardianId = guardianIds.get(link.guardianSeedKey);
    const guardianRelationshipId = relationshipIds.get(link.relationship);
    const studentId = studentFixtureId(campusId, link.studentSeedKey);
    if (!guardianId || !guardianRelationshipId) {
      throw new Error(`Invalid guardian fixture link ${JSON.stringify(link)}.`);
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { campusId: true },
    });
    if (!student || student.campusId !== campusId) {
      throw new Error(
        `Student ${link.studentSeedKey} is missing from seed campus ${campusId}. Run the student seed first.`,
      );
    }

    await prisma.guardianStudent.upsert({
      where: { studentId_guardianId: { studentId, guardianId } },
      create: { studentId, guardianId, guardianRelationshipId },
      update: { guardianRelationshipId },
    });
  }

  console.log(
    `Guardian seed completed for ${campus.name}: ${GUARDIAN_FIXTURES.length} guardians, ${GUARDIAN_STUDENT_LINKS.length} links.`,
  );

  return {
    campusId,
    guardianIds,
    relationshipIds,
    configuredParentUserId,
  };
}

if (require.main === module) {
  void runSeedCli((prisma) => seedGuardians(prisma));
}
