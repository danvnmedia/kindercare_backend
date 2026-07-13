import { createHash } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const CATEGORY_SEEDS = [
  { key: "announcements", name: "Announcements", color: "#2563EB", icon: "📢" },
  { key: "classroom", name: "Classroom", color: "#7C3AED", icon: "🎨" },
  { key: "events", name: "Events", color: "#EA580C", icon: "🎉" },
  { key: "meals", name: "Meals", color: "#16A34A", icon: "🍎" },
  { key: "health", name: "Health & Safety", color: "#DC2626", icon: "🩺" },
] as const;

type CategoryKey = (typeof CATEGORY_SEEDS)[number]["key"];
type CategoryIds = Record<CategoryKey, string>;

const SEED_IDS = {
  settings: [
    "70000000-0000-4000-8000-000000000001",
    "70000000-0000-4000-8000-000000000002",
    "70000000-0000-4000-8000-000000000003",
  ],
  categories: [
    [
      "71000000-0000-4000-8000-000000000001",
      "71000000-0000-4000-8000-000000000002",
      "71000000-0000-4000-8000-000000000003",
      "71000000-0000-4000-8000-000000000004",
      "71000000-0000-4000-8000-000000000005",
    ],
    [
      "72000000-0000-4000-8000-000000000001",
      "72000000-0000-4000-8000-000000000002",
      "72000000-0000-4000-8000-000000000003",
      "72000000-0000-4000-8000-000000000004",
      "72000000-0000-4000-8000-000000000005",
    ],
    [
      "73000000-0000-4000-8000-000000000001",
      "73000000-0000-4000-8000-000000000002",
      "73000000-0000-4000-8000-000000000003",
      "73000000-0000-4000-8000-000000000004",
      "73000000-0000-4000-8000-000000000005",
    ],
  ],
  gradeLevel: "74000000-0000-4000-8000-000000000001",
  schoolYear: "74000000-0000-4000-8000-000000000002",
  class: "74000000-0000-4000-8000-000000000003",
  student: "74000000-0000-4000-8000-000000000004",
  schoolYearEnrollment: "74000000-0000-4000-8000-000000000005",
  enrollment: "74000000-0000-4000-8000-000000000006",
  guardianRelationship: "74000000-0000-4000-8000-000000000007",
  teacherUser: "75000000-0000-4000-8000-000000000001",
  teacherStaff: "75000000-0000-4000-8000-000000000002",
  parentUser: "75000000-0000-4000-8000-000000000003",
  parentGuardian: "75000000-0000-4000-8000-000000000004",
  managerUser: "75000000-0000-4000-8000-000000000005",
  managerStaff: [
    "75000000-0000-4000-8000-000000000006",
    "75000000-0000-4000-8000-000000000007",
    "75000000-0000-4000-8000-000000000008",
  ],
  teacherRole: "76000000-0000-4000-8000-000000000001",
  parentRole: "76000000-0000-4000-8000-000000000002",
  managerRoles: [
    "76000000-0000-4000-8000-000000000003",
    "76000000-0000-4000-8000-000000000004",
    "76000000-0000-4000-8000-000000000005",
  ],
} as const;

interface SeedUser {
  id: string;
  clerkUid: string;
}

interface StatusSeed {
  id: string;
  previousStatus: string | null;
  newStatus: string;
  changedById: string;
  reason?: string;
  createdAt: Date;
}

interface ApprovalSeed {
  id: string;
  submittedById: string;
  submittedAt: Date;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedById?: string;
  reviewedAt?: Date;
  reviewNote?: string;
}

interface CommentSeed {
  id: string;
  userId: string;
  parentCommentId?: string;
  depth?: number;
  content: string;
  commentType?: "PUBLIC" | "MANAGEMENT";
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedById?: string;
  createdAt: Date;
}

interface PostSeed {
  id: string;
  clientMutationId: string;
  campusId: string;
  authorId: string;
  title: string;
  paragraphs: string[];
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED";
  publishAt: Date | null;
  requiresApproval: boolean;
  isPinned?: boolean;
  pinnedUntil?: Date;
  pinnedById?: string;
  createdAt: Date;
  audiences: Array<{ id: string; type: "ALL" | "CLASS"; classId?: string }>;
  categoryIds: string[];
  statusHistory: StatusSeed[];
  approval?: ApprovalSeed;
  comments?: CommentSeed[];
  reactionUserIds?: Array<{ id: string; userId: string; createdAt: Date }>;
}

function dateFromNow(now: Date, milliseconds: number): Date {
  return new Date(now.getTime() + milliseconds);
}

function dateOnly(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function tiptapDocument(paragraphs: string[]): Prisma.InputJsonValue {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })),
  };
}

function payloadHash(seed: PostSeed): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        campusId: seed.campusId,
        title: seed.title,
        paragraphs: seed.paragraphs,
      }),
    )
    .digest("hex");
}

async function resolveSeedUser(
  prisma: PrismaClient,
  id: string,
  clerkUid: string,
): Promise<SeedUser> {
  const existingByClerkUid = await prisma.user.findUnique({
    where: { clerkUid },
    select: { id: true, clerkUid: true },
  });
  if (existingByClerkUid) {
    await prisma.user.update({
      where: { id: existingByClerkUid.id },
      data: { isActive: true },
    });
    return existingByClerkUid;
  }

  const user = await prisma.user.upsert({
    where: { id },
    update: { clerkUid, isActive: true },
    create: { id, clerkUid, isActive: true },
    select: { id: true, clerkUid: true },
  });
  return user;
}

async function ensureStaffProfile(
  prisma: PrismaClient,
  input: {
    id: string;
    userId: string;
    campusId: string;
    staffCode: string;
    fullName: string;
    email: string;
    phoneNumber: string;
  },
): Promise<string> {
  const existingForUser = await prisma.staff.findFirst({
    where: { campusId: input.campusId, userId: input.userId },
    select: { id: true },
  });
  if (existingForUser && existingForUser.id !== input.id) {
    return existingForUser.id;
  }

  const staff = await prisma.staff.upsert({
    where: { id: input.id },
    update: {
      userId: input.userId,
      fullName: input.fullName,
      isArchived: false,
    },
    create: {
      ...input,
      isArchived: false,
    },
    select: { id: true },
  });
  return staff.id;
}

async function ensureGuardianProfile(
  prisma: PrismaClient,
  input: {
    id: string;
    userId: string;
    campusId: string;
    fullName: string;
    email: string;
    phoneNumber: string;
  },
): Promise<string> {
  const existingForUser = await prisma.guardian.findFirst({
    where: { campusId: input.campusId, userId: input.userId },
    select: { id: true },
  });
  if (existingForUser && existingForUser.id !== input.id) {
    return existingForUser.id;
  }

  const guardian = await prisma.guardian.upsert({
    where: { id: input.id },
    update: {
      userId: input.userId,
      fullName: input.fullName,
      isArchived: false,
    },
    create: {
      ...input,
      isArchived: false,
    },
    select: { id: true },
  });
  return guardian.id;
}

async function ensureCampusRole(
  prisma: PrismaClient,
  input: {
    id: string;
    campusId: string;
    name: string;
    description: string;
    permissionIds: string[];
  },
): Promise<string> {
  const existing = await prisma.role.findFirst({
    where: { campusId: input.campusId, name: input.name },
    select: { id: true },
  });
  const role = existing
    ? await prisma.role.update({
        where: { id: existing.id },
        data: { description: input.description },
        select: { id: true },
      })
    : await prisma.role.create({
        data: {
          id: input.id,
          campusId: input.campusId,
          name: input.name,
          description: input.description,
        },
        select: { id: true },
      });

  await prisma.rolePermission.createMany({
    data: input.permissionIds.map((permissionId) => ({
      roleId: role.id,
      permissionId,
    })),
    skipDuplicates: true,
  });
  return role.id;
}

async function assignRole(
  prisma: PrismaClient,
  input: {
    id: string;
    userId: string;
    roleId: string;
    campusId: string;
  },
): Promise<void> {
  const existingForUser = await prisma.userRole.findFirst({
    where: {
      userId: input.userId,
      roleId: input.roleId,
      campusId: input.campusId,
      grantedViaStaffTypeId: null,
    },
  });
  if (existingForUser) return;

  const existingSeedAssignment = await prisma.userRole.findUnique({
    where: { id: input.id },
  });
  if (existingSeedAssignment) {
    await prisma.userRole.update({
      where: { id: input.id },
      data: {
        userId: input.userId,
        roleId: input.roleId,
        campusId: input.campusId,
        grantedViaStaffTypeId: null,
      },
    });
    return;
  }

  await prisma.userRole.create({
    data: { ...input, grantedViaStaffTypeId: null },
  });
}

async function seedCategories(
  prisma: PrismaClient,
  campusId: string,
  campusIndex: number,
): Promise<CategoryIds> {
  const existing = await prisma.postCategory.findMany({
    where: { campusId },
  });
  const seededNames = new Set(
    CATEGORY_SEEDS.map((category) => category.name.trim().toLocaleLowerCase()),
  );
  const highestNonSeedOrder = existing.reduce((highest, category) => {
    const normalizedName = category.name.trim().toLocaleLowerCase();
    return !category.isArchived && !seededNames.has(normalizedName)
      ? Math.max(highest, category.order)
      : highest;
  }, 0);
  const existingSeedCategories = existing.filter((category) =>
    seededNames.has(category.name.trim().toLocaleLowerCase()),
  );
  const highestOrder = existing.reduce(
    (highest, category) => Math.max(highest, category.order),
    0,
  );
  const temporaryFirstOrder = highestOrder + CATEGORY_SEEDS.length + 1;
  await prisma.$transaction(
    existingSeedCategories.map((category, index) =>
      prisma.postCategory.update({
        where: { id: category.id },
        data: { order: temporaryFirstOrder + index },
      }),
    ),
  );

  const firstOrder = highestNonSeedOrder + 1;
  const result = {} as CategoryIds;

  for (const [index, categorySeed] of CATEGORY_SEEDS.entries()) {
    const existingCategory = existing.find(
      (category) =>
        category.name.trim().toLocaleLowerCase() ===
        categorySeed.name.trim().toLocaleLowerCase(),
    );
    const category = existingCategory
      ? await prisma.postCategory.update({
          where: { id: existingCategory.id },
          data: {
            name: categorySeed.name,
            color: categorySeed.color,
            icon: categorySeed.icon,
            order: firstOrder + index,
            isArchived: false,
          },
        })
      : await prisma.postCategory.create({
          data: {
            id: SEED_IDS.categories[campusIndex][index],
            campusId,
            name: categorySeed.name,
            color: categorySeed.color,
            icon: categorySeed.icon,
            order: firstOrder + index,
          },
        });
    result[categorySeed.key] = category.id;
  }

  return result;
}

async function seedAcademicContext(
  prisma: PrismaClient,
  campusId: string,
  teacherStaffId: string,
  parentGuardianId: string,
): Promise<string> {
  const now = new Date();
  const academicStartYear =
    now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const schoolYearName = `${academicStartYear}-${academicStartYear + 1}`;

  const existingGradeLevel = await prisma.gradeLevel.findFirst({
    where: { campusId, name: "Preschool" },
  });
  const gradeLevel = existingGradeLevel
    ? await prisma.gradeLevel.update({
        where: { id: existingGradeLevel.id },
        data: { isArchived: false },
      })
    : await prisma.gradeLevel.create({
        data: {
          id: SEED_IDS.gradeLevel,
          campusId,
          name: "Preschool",
          order:
            ((
              await prisma.gradeLevel.aggregate({
                where: { campusId },
                _max: { order: true },
              })
            )._max.order ?? -1) + 1,
          isArchived: false,
        },
      });

  const existingSchoolYear = await prisma.schoolYear.findFirst({
    where: { campusId, name: schoolYearName },
  });
  const schoolYear = existingSchoolYear
    ? await prisma.schoolYear.update({
        where: { id: existingSchoolYear.id },
        data: {
          startDate: dateOnly(academicStartYear, 7, 1),
          endDate: dateOnly(academicStartYear + 1, 6, 31),
          isArchived: false,
        },
      })
    : await prisma.schoolYear.create({
        data: {
          id: SEED_IDS.schoolYear,
          campusId,
          name: schoolYearName,
          startDate: dateOnly(academicStartYear, 7, 1),
          endDate: dateOnly(academicStartYear + 1, 6, 31),
        },
      });

  const existingClass = await prisma.class.findFirst({
    where: {
      campusId,
      gradeLevelId: gradeLevel.id,
      schoolYearId: schoolYear.id,
      name: "Sunflower Class",
    },
  });
  const classroom = existingClass
    ? await prisma.class.update({
        where: { id: existingClass.id },
        data: { description: "CMS demo class for audience visibility testing" },
      })
    : await prisma.class.create({
        data: {
          id: SEED_IDS.class,
          campusId,
          gradeLevelId: gradeLevel.id,
          schoolYearId: schoolYear.id,
          name: "Sunflower Class",
          description: "CMS demo class for audience visibility testing",
        },
      });

  const currentHomeroom = await prisma.classStaff.findFirst({
    where: { classId: classroom.id, role: "HOMEROOM" },
  });
  await prisma.classStaff.upsert({
    where: {
      classId_staffId: { classId: classroom.id, staffId: teacherStaffId },
    },
    update: {
      role:
        !currentHomeroom || currentHomeroom.staffId === teacherStaffId
          ? "HOMEROOM"
          : "ASSISTANT",
    },
    create: {
      classId: classroom.id,
      staffId: teacherStaffId,
      role: currentHomeroom ? "ASSISTANT" : "HOMEROOM",
    },
  });

  const existingStudent = await prisma.student.findFirst({
    where: { campusId, studentCode: "CMS-DEMO-001" },
  });
  const student = existingStudent
    ? await prisma.student.update({
        where: { id: existingStudent.id },
        data: { fullName: "Minh Anh Nguyen", isArchived: false },
      })
    : await prisma.student.create({
        data: {
          id: SEED_IDS.student,
          campusId,
          studentCode: "CMS-DEMO-001",
          fullName: "Minh Anh Nguyen",
          nickname: "Mia",
          dateOfBirth: dateOnly(2021, 3, 12),
          gender: "FEMALE",
        },
      });

  const existingRelationship = await prisma.guardianRelationship.findFirst({
    where: { campusId, name: "Parent" },
  });
  const relationship = existingRelationship
    ? existingRelationship
    : await prisma.guardianRelationship.create({
        data: {
          id: SEED_IDS.guardianRelationship,
          campusId,
          name: "Parent",
          description: "Parent or primary guardian",
          order:
            ((
              await prisma.guardianRelationship.aggregate({
                where: { campusId },
                _max: { order: true },
              })
            )._max.order ?? -1) + 1,
        },
      });

  await prisma.guardianStudent.upsert({
    where: {
      studentId_guardianId: {
        studentId: student.id,
        guardianId: parentGuardianId,
      },
    },
    update: { guardianRelationshipId: relationship.id },
    create: {
      studentId: student.id,
      guardianId: parentGuardianId,
      guardianRelationshipId: relationship.id,
    },
  });

  const enrollmentDate = dateOnly(academicStartYear, 7, 1);
  const existingSchoolYearEnrollment =
    await prisma.schoolYearEnrollment.findFirst({
      where: { studentId: student.id, schoolYearId: schoolYear.id },
    });
  const schoolYearEnrollment = existingSchoolYearEnrollment
    ? await prisma.schoolYearEnrollment.update({
        where: { id: existingSchoolYearEnrollment.id },
        data: {
          campusId,
          gradeLevelId: gradeLevel.id,
          enrollmentDate,
          exitDate: null,
          exitReason: null,
        },
      })
    : await prisma.schoolYearEnrollment.create({
        data: {
          id: SEED_IDS.schoolYearEnrollment,
          studentId: student.id,
          campusId,
          schoolYearId: schoolYear.id,
          gradeLevelId: gradeLevel.id,
          enrollmentDate,
          note: "CMS audience demo enrollment",
        },
      });

  const activeEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: student.id, endDate: null },
  });
  if (activeEnrollment) {
    await prisma.enrollment.update({
      where: { id: activeEnrollment.id },
      data: {
        classId: classroom.id,
        schoolYearEnrollmentId: schoolYearEnrollment.id,
        enrollmentDate,
      },
    });
  } else {
    await prisma.enrollment.create({
      data: {
        id: SEED_IDS.enrollment,
        studentId: student.id,
        classId: classroom.id,
        schoolYearEnrollmentId: schoolYearEnrollment.id,
        enrollmentDate,
        note: "CMS audience demo enrollment",
      },
    });
  }

  return classroom.id;
}

async function seedPost(prisma: PrismaClient, seed: PostSeed): Promise<void> {
  const content = tiptapDocument(seed.paragraphs);
  const contentText = seed.paragraphs.join("\n");

  await prisma.$transaction(async (tx) => {
    await tx.post.upsert({
      where: { id: seed.id },
      update: {
        campusId: seed.campusId,
        authorId: seed.authorId,
        title: seed.title,
        content,
        contentText,
        contentVersion: 1,
        clientMutationId: seed.clientMutationId,
        requestPayloadHash: payloadHash(seed),
        status: seed.status,
        publishAt: seed.publishAt,
        isPinned: seed.isPinned ?? false,
        pinnedUntil: seed.pinnedUntil ?? null,
        pinnedById: seed.pinnedById ?? null,
        requiresApproval: seed.requiresApproval,
        isDeleted: false,
        deletedAt: null,
        createdAt: seed.createdAt,
      },
      create: {
        id: seed.id,
        campusId: seed.campusId,
        authorId: seed.authorId,
        title: seed.title,
        content,
        contentText,
        contentVersion: 1,
        clientMutationId: seed.clientMutationId,
        requestPayloadHash: payloadHash(seed),
        status: seed.status,
        publishAt: seed.publishAt,
        isPinned: seed.isPinned ?? false,
        pinnedUntil: seed.pinnedUntil ?? null,
        pinnedById: seed.pinnedById ?? null,
        requiresApproval: seed.requiresApproval,
        createdAt: seed.createdAt,
      },
    });

    await tx.postComment.deleteMany({ where: { postId: seed.id } });
    await tx.postReaction.deleteMany({ where: { postId: seed.id } });
    await tx.postApprovalRequest.deleteMany({ where: { postId: seed.id } });
    await tx.postHistoryStatus.deleteMany({ where: { postId: seed.id } });
    await tx.postAudience.deleteMany({ where: { postId: seed.id } });
    await tx.postCategoryLink.deleteMany({ where: { postId: seed.id } });

    await tx.postAudience.createMany({
      data: seed.audiences.map((audience) => ({
        id: audience.id,
        postId: seed.id,
        campusId: seed.campusId,
        type: audience.type,
        classId: audience.classId ?? null,
      })),
    });
    await tx.postCategoryLink.createMany({
      data: seed.categoryIds.map((categoryId) => ({
        postId: seed.id,
        categoryId,
      })),
    });
    await tx.postHistoryStatus.createMany({
      data: seed.statusHistory.map((entry) => ({
        ...entry,
        postId: seed.id,
      })),
    });

    if (seed.approval) {
      await tx.postApprovalRequest.create({
        data: {
          id: seed.approval.id,
          postId: seed.id,
          submittedById: seed.approval.submittedById,
          submittedAt: seed.approval.submittedAt,
          status: seed.approval.status,
          reviewedById: seed.approval.reviewedById ?? null,
          reviewedAt: seed.approval.reviewedAt ?? null,
          reviewNote: seed.approval.reviewNote ?? null,
          titleSnapshot: seed.title,
          contentSnapshot: content,
          createdAt: seed.approval.submittedAt,
        },
      });
    }

    for (const comment of seed.comments ?? []) {
      await tx.postComment.create({
        data: {
          id: comment.id,
          postId: seed.id,
          userId: comment.userId,
          parentCommentId: comment.parentCommentId ?? null,
          depth: comment.depth ?? 0,
          content: comment.content,
          commentType: comment.commentType ?? "PUBLIC",
          isDeleted: comment.isDeleted ?? false,
          deletedAt: comment.deletedAt ?? null,
          deletedById: comment.deletedById ?? null,
          createdAt: comment.createdAt,
          updatedAt: comment.createdAt,
        },
      });
    }

    if (seed.reactionUserIds?.length) {
      await tx.postReaction.createMany({
        data: seed.reactionUserIds.map((reaction) => ({
          ...reaction,
          postId: seed.id,
        })),
      });
    }
  });
}

export async function seedCmsDemo(
  prisma: PrismaClient,
  campusIds: string[],
): Promise<void> {
  if (campusIds.length < 3) {
    throw new Error("CMS demo seed requires the three base campuses.");
  }

  console.log("Seeding CMS demo data...");
  const [primaryCampusId, secondaryCampusId, restrictedCampusId] = campusIds;
  const now = new Date();

  const teacher = await resolveSeedUser(
    prisma,
    SEED_IDS.teacherUser,
    process.env.SEED_CMS_TEACHER_CLERK_UID ?? "seed-cms-teacher",
  );
  const parent = await resolveSeedUser(
    prisma,
    SEED_IDS.parentUser,
    process.env.SEED_CMS_PARENT_CLERK_UID ?? "seed-cms-parent",
  );
  const manager = await resolveSeedUser(
    prisma,
    SEED_IDS.managerUser,
    process.env.SEED_CMS_MANAGER_CLERK_UID ??
      process.env.SEED_SUPER_ADMIN_CLERK_UID ??
      "seed-cms-manager",
  );

  const teacherStaffId = await ensureStaffProfile(prisma, {
    id: SEED_IDS.teacherStaff,
    userId: teacher.id,
    campusId: primaryCampusId,
    staffCode: "CMS-TEACHER-001",
    fullName: "Linh Nguyen",
    email: "linh.nguyen.cms@seed.kindercare.local",
    phoneNumber: "+84910000001",
  });
  const parentGuardianId = await ensureGuardianProfile(prisma, {
    id: SEED_IDS.parentGuardian,
    userId: parent.id,
    campusId: primaryCampusId,
    fullName: "Mai Tran",
    email: "mai.tran.cms@seed.kindercare.local",
    phoneNumber: "+84910000002",
  });

  for (const [index, campusId] of campusIds.entries()) {
    await ensureStaffProfile(prisma, {
      id: SEED_IDS.managerStaff[index],
      userId: manager.id,
      campusId,
      staffCode: `CMS-MANAGER-00${index + 1}`,
      fullName: "An Pham",
      email: `an.pham.cms.${index + 1}@seed.kindercare.local`,
      phoneNumber: `+8491000001${index}`,
    });
  }

  const teacherRoleId = await ensureCampusRole(prisma, {
    id: SEED_IDS.teacherRole,
    campusId: primaryCampusId,
    name: "CMS Teacher",
    description:
      "Creates and manages their campus posts without moderation access",
    permissionIds: [
      "post.create",
      "post.read",
      "post.update",
      "post.delete",
      "post.list",
      "file.create",
      "file.read",
      "file.delete",
      "file.list",
    ],
  });
  const parentRoleId = await ensureCampusRole(prisma, {
    id: SEED_IDS.parentRole,
    campusId: primaryCampusId,
    name: "CMS Parent",
    description:
      "Reads visible campus and class posts and participates in engagement",
    permissionIds: ["post.read", "post.list", "file.read"],
  });

  await assignRole(prisma, {
    id: "77000000-0000-4000-8000-000000000001",
    userId: teacher.id,
    roleId: teacherRoleId,
    campusId: primaryCampusId,
  });
  await assignRole(prisma, {
    id: "77000000-0000-4000-8000-000000000002",
    userId: parent.id,
    roleId: parentRoleId,
    campusId: primaryCampusId,
  });

  for (const [index, campusId] of campusIds.entries()) {
    const managerRoleId = await ensureCampusRole(prisma, {
      id: SEED_IDS.managerRoles[index],
      campusId,
      name: "CMS Manager",
      description: "Manages posts, approvals, categories, settings, and files",
      permissionIds: [
        "post.create",
        "post.read",
        "post.update",
        "post.delete",
        "post.list",
        "post.review",
        "post.manage",
        "file.create",
        "file.read",
        "file.delete",
        "file.list",
        "file.manage",
      ],
    });
    await assignRole(prisma, {
      id: `77000000-0000-4000-8000-00000000001${index + 3}`,
      userId: manager.id,
      roleId: managerRoleId,
      campusId,
    });
  }

  const classroomId = await seedAcademicContext(
    prisma,
    primaryCampusId,
    teacherStaffId,
    parentGuardianId,
  );

  const categories: CategoryIds[] = [];
  for (const [index, campusId] of campusIds.entries()) {
    categories.push(await seedCategories(prisma, campusId, index));
    await prisma.campusSetting.upsert({
      where: { campusId },
      update: {
        requireTeacherApproval: index !== 1,
        maxPinnedPosts: index === 1 ? 5 : 3,
        allowParentComments: index !== 2,
        allowReactions: index !== 2,
      },
      create: {
        id: SEED_IDS.settings[index],
        campusId,
        requireTeacherApproval: index !== 1,
        maxPinnedPosts: index === 1 ? 5 : 3,
        allowParentComments: index !== 2,
        allowReactions: index !== 2,
      },
    });
  }

  const postSeeds: PostSeed[] = [
    {
      id: "80000000-0000-4000-8000-000000000001",
      clientMutationId: "86000000-0000-4000-8000-000000000001",
      campusId: primaryCampusId,
      authorId: manager.id,
      title: "Welcome to the KinderCare family hub",
      paragraphs: [
        "Welcome to our new family hub. Announcements, classroom moments, and important reminders now live in one place.",
        "Please check back regularly and reach out in the comments when you have questions.",
      ],
      status: "PUBLISHED",
      publishAt: dateFromNow(now, -5 * HOUR_MS),
      requiresApproval: true,
      isPinned: true,
      pinnedUntil: dateFromNow(now, 7 * DAY_MS),
      pinnedById: manager.id,
      createdAt: dateFromNow(now, -6 * HOUR_MS),
      audiences: [{ id: "81000000-0000-4000-8000-000000000001", type: "ALL" }],
      categoryIds: [categories[0].announcements, categories[0].events],
      statusHistory: [
        {
          id: "83000000-0000-4000-8000-000000000001",
          previousStatus: null,
          newStatus: "DRAFT",
          changedById: manager.id,
          createdAt: dateFromNow(now, -6 * HOUR_MS),
        },
        {
          id: "83000000-0000-4000-8000-000000000002",
          previousStatus: "DRAFT",
          newStatus: "PENDING_REVIEW",
          changedById: manager.id,
          createdAt: dateFromNow(now, -5.5 * HOUR_MS),
        },
        {
          id: "83000000-0000-4000-8000-000000000003",
          previousStatus: "PENDING_REVIEW",
          newStatus: "PUBLISHED",
          changedById: manager.id,
          reason: "Approved for the campus launch",
          createdAt: dateFromNow(now, -5 * HOUR_MS),
        },
      ],
      approval: {
        id: "82000000-0000-4000-8000-000000000001",
        submittedById: manager.id,
        submittedAt: dateFromNow(now, -5.5 * HOUR_MS),
        status: "APPROVED",
        reviewedById: manager.id,
        reviewedAt: dateFromNow(now, -5 * HOUR_MS),
        reviewNote: "Approved for the campus launch",
      },
      comments: [
        {
          id: "84000000-0000-4000-8000-000000000001",
          userId: parent.id,
          content:
            "Thank you! This makes school updates much easier to follow.",
          createdAt: dateFromNow(now, -3 * HOUR_MS),
        },
        {
          id: "84000000-0000-4000-8000-000000000002",
          userId: manager.id,
          parentCommentId: "84000000-0000-4000-8000-000000000001",
          depth: 1,
          content:
            "Glad to hear it. More classroom updates are coming this week!",
          createdAt: dateFromNow(now, -2.5 * HOUR_MS),
        },
      ],
      reactionUserIds: [
        {
          id: "85000000-0000-4000-8000-000000000001",
          userId: teacher.id,
          createdAt: dateFromNow(now, -4 * HOUR_MS),
        },
        {
          id: "85000000-0000-4000-8000-000000000002",
          userId: parent.id,
          createdAt: dateFromNow(now, -3.5 * HOUR_MS),
        },
      ],
    },
    {
      id: "80000000-0000-4000-8000-000000000002",
      clientMutationId: "86000000-0000-4000-8000-000000000002",
      campusId: primaryCampusId,
      authorId: teacher.id,
      title: "Sunflower Class discovers colors in nature",
      paragraphs: [
        "Today the children explored the garden and collected safe natural items in every color of the rainbow.",
        "Ask your child which color was the hardest to find.",
      ],
      status: "PUBLISHED",
      publishAt: dateFromNow(now, -2 * DAY_MS),
      requiresApproval: true,
      createdAt: dateFromNow(now, -2.2 * DAY_MS),
      audiences: [
        {
          id: "81000000-0000-4000-8000-000000000002",
          type: "CLASS",
          classId: classroomId,
        },
      ],
      categoryIds: [categories[0].classroom],
      statusHistory: [
        {
          id: "83000000-0000-4000-8000-000000000004",
          previousStatus: null,
          newStatus: "DRAFT",
          changedById: teacher.id,
          createdAt: dateFromNow(now, -2.2 * DAY_MS),
        },
        {
          id: "83000000-0000-4000-8000-000000000005",
          previousStatus: "DRAFT",
          newStatus: "PENDING_REVIEW",
          changedById: teacher.id,
          createdAt: dateFromNow(now, -2.1 * DAY_MS),
        },
        {
          id: "83000000-0000-4000-8000-000000000006",
          previousStatus: "PENDING_REVIEW",
          newStatus: "PUBLISHED",
          changedById: manager.id,
          createdAt: dateFromNow(now, -2 * DAY_MS),
        },
      ],
      approval: {
        id: "82000000-0000-4000-8000-000000000002",
        submittedById: teacher.id,
        submittedAt: dateFromNow(now, -2.1 * DAY_MS),
        status: "APPROVED",
        reviewedById: manager.id,
        reviewedAt: dateFromNow(now, -2 * DAY_MS),
      },
      comments: [
        {
          id: "84000000-0000-4000-8000-000000000003",
          userId: parent.id,
          content: "Mia loved telling us about the purple flowers!",
          createdAt: dateFromNow(now, -1.5 * DAY_MS),
        },
        {
          id: "84000000-0000-4000-8000-000000000004",
          userId: teacher.id,
          parentCommentId: "84000000-0000-4000-8000-000000000003",
          depth: 1,
          content: "She found the first one and helped her friends spot more.",
          createdAt: dateFromNow(now, -1.4 * DAY_MS),
        },
        {
          id: "84000000-0000-4000-8000-000000000005",
          userId: parent.id,
          content: "This comment was removed by a moderator.",
          isDeleted: true,
          deletedAt: dateFromNow(now, -1.1 * DAY_MS),
          deletedById: manager.id,
          createdAt: dateFromNow(now, -1.2 * DAY_MS),
        },
      ],
      reactionUserIds: [
        {
          id: "85000000-0000-4000-8000-000000000003",
          userId: parent.id,
          createdAt: dateFromNow(now, -1.5 * DAY_MS),
        },
        {
          id: "85000000-0000-4000-8000-000000000004",
          userId: manager.id,
          createdAt: dateFromNow(now, -1.8 * DAY_MS),
        },
      ],
    },
    {
      id: "80000000-0000-4000-8000-000000000003",
      clientMutationId: "86000000-0000-4000-8000-000000000003",
      campusId: primaryCampusId,
      authorId: teacher.id,
      title: "Family picnic activity plan",
      paragraphs: [
        "The Sunflower Class picnic will include a nature scavenger hunt, music, and a shared snack table.",
        "Please review the draft schedule before we send the final announcement.",
      ],
      status: "PENDING_REVIEW",
      publishAt: null,
      requiresApproval: true,
      createdAt: dateFromNow(now, -5 * DAY_MS),
      audiences: [{ id: "81000000-0000-4000-8000-000000000003", type: "ALL" }],
      categoryIds: [categories[0].events],
      statusHistory: [
        {
          id: "83000000-0000-4000-8000-000000000007",
          previousStatus: null,
          newStatus: "DRAFT",
          changedById: teacher.id,
          createdAt: dateFromNow(now, -5 * DAY_MS),
        },
        {
          id: "83000000-0000-4000-8000-000000000008",
          previousStatus: "DRAFT",
          newStatus: "PENDING_REVIEW",
          changedById: teacher.id,
          createdAt: dateFromNow(now, -4 * DAY_MS),
        },
      ],
      approval: {
        id: "82000000-0000-4000-8000-000000000003",
        submittedById: teacher.id,
        submittedAt: dateFromNow(now, -4 * DAY_MS),
        status: "PENDING",
      },
    },
    {
      id: "80000000-0000-4000-8000-000000000004",
      clientMutationId: "86000000-0000-4000-8000-000000000004",
      campusId: primaryCampusId,
      authorId: teacher.id,
      title: "Sunflower Class allergy reminder",
      paragraphs: [
        "Please keep all snacks nut-free for Friday's class celebration.",
        "Ingredient labels can be shared with the front desk before drop-off.",
      ],
      status: "PENDING_REVIEW",
      publishAt: null,
      requiresApproval: true,
      createdAt: dateFromNow(now, -2 * HOUR_MS),
      audiences: [
        {
          id: "81000000-0000-4000-8000-000000000004",
          type: "CLASS",
          classId: classroomId,
        },
      ],
      categoryIds: [categories[0].health, categories[0].classroom],
      statusHistory: [
        {
          id: "83000000-0000-4000-8000-000000000009",
          previousStatus: null,
          newStatus: "DRAFT",
          changedById: teacher.id,
          createdAt: dateFromNow(now, -2 * HOUR_MS),
        },
        {
          id: "83000000-0000-4000-8000-000000000010",
          previousStatus: "DRAFT",
          newStatus: "PENDING_REVIEW",
          changedById: teacher.id,
          createdAt: dateFromNow(now, -HOUR_MS),
        },
      ],
      approval: {
        id: "82000000-0000-4000-8000-000000000004",
        submittedById: teacher.id,
        submittedAt: dateFromNow(now, -HOUR_MS),
        status: "PENDING",
      },
    },
    {
      id: "80000000-0000-4000-8000-000000000005",
      clientMutationId: "86000000-0000-4000-8000-000000000005",
      campusId: primaryCampusId,
      authorId: teacher.id,
      title: "Field trip recap needs revision",
      paragraphs: [
        "The children enjoyed the science center and asked thoughtful questions about space.",
        "Add the missing consent reminder before submitting this post again.",
      ],
      status: "DRAFT",
      publishAt: null,
      requiresApproval: true,
      createdAt: dateFromNow(now, -3 * DAY_MS),
      audiences: [
        {
          id: "81000000-0000-4000-8000-000000000005",
          type: "CLASS",
          classId: classroomId,
        },
      ],
      categoryIds: [categories[0].classroom, categories[0].events],
      statusHistory: [
        {
          id: "83000000-0000-4000-8000-000000000011",
          previousStatus: null,
          newStatus: "DRAFT",
          changedById: teacher.id,
          createdAt: dateFromNow(now, -3 * DAY_MS),
        },
        {
          id: "83000000-0000-4000-8000-000000000012",
          previousStatus: "DRAFT",
          newStatus: "PENDING_REVIEW",
          changedById: teacher.id,
          createdAt: dateFromNow(now, -2.5 * DAY_MS),
        },
        {
          id: "83000000-0000-4000-8000-000000000013",
          previousStatus: "PENDING_REVIEW",
          newStatus: "DRAFT",
          changedById: manager.id,
          reason: "Please add the consent reminder before publishing.",
          createdAt: dateFromNow(now, -2 * DAY_MS),
        },
      ],
      approval: {
        id: "82000000-0000-4000-8000-000000000005",
        submittedById: teacher.id,
        submittedAt: dateFromNow(now, -2.5 * DAY_MS),
        status: "REJECTED",
        reviewedById: manager.id,
        reviewedAt: dateFromNow(now, -2 * DAY_MS),
        reviewNote: "Please add the consent reminder before publishing.",
      },
    },
    {
      id: "80000000-0000-4000-8000-000000000006",
      clientMutationId: "86000000-0000-4000-8000-000000000006",
      campusId: primaryCampusId,
      authorId: teacher.id,
      title: "Next week's lunch highlights",
      paragraphs: [
        "Draft menu highlights include pumpkin soup, vegetable noodles, and fresh seasonal fruit.",
        "Nutrition details will be added before submission.",
      ],
      status: "DRAFT",
      publishAt: null,
      requiresApproval: true,
      createdAt: dateFromNow(now, -30 * 60 * 1000),
      audiences: [{ id: "81000000-0000-4000-8000-000000000006", type: "ALL" }],
      categoryIds: [categories[0].meals],
      statusHistory: [
        {
          id: "83000000-0000-4000-8000-000000000014",
          previousStatus: null,
          newStatus: "DRAFT",
          changedById: teacher.id,
          createdAt: dateFromNow(now, -30 * 60 * 1000),
        },
      ],
    },
    {
      id: "80000000-0000-4000-8000-000000000007",
      clientMutationId: "86000000-0000-4000-8000-000000000007",
      campusId: primaryCampusId,
      authorId: manager.id,
      title: "Archived winter holiday schedule",
      paragraphs: [
        "This historical announcement is retained to test archived post filtering.",
      ],
      status: "ARCHIVED",
      publishAt: dateFromNow(now, -9 * DAY_MS),
      requiresApproval: true,
      createdAt: dateFromNow(now, -10 * DAY_MS),
      audiences: [{ id: "81000000-0000-4000-8000-000000000007", type: "ALL" }],
      categoryIds: [categories[0].announcements],
      statusHistory: [
        {
          id: "83000000-0000-4000-8000-000000000015",
          previousStatus: null,
          newStatus: "DRAFT",
          changedById: manager.id,
          createdAt: dateFromNow(now, -10 * DAY_MS),
        },
        {
          id: "83000000-0000-4000-8000-000000000016",
          previousStatus: "DRAFT",
          newStatus: "PUBLISHED",
          changedById: manager.id,
          createdAt: dateFromNow(now, -9 * DAY_MS),
        },
        {
          id: "83000000-0000-4000-8000-000000000017",
          previousStatus: "PUBLISHED",
          newStatus: "ARCHIVED",
          changedById: manager.id,
          createdAt: dateFromNow(now, -DAY_MS),
        },
      ],
      approval: {
        id: "82000000-0000-4000-8000-000000000006",
        submittedById: manager.id,
        submittedAt: dateFromNow(now, -9.5 * DAY_MS),
        status: "APPROVED",
        reviewedById: manager.id,
        reviewedAt: dateFromNow(now, -9 * DAY_MS),
      },
    },
    {
      id: "80000000-0000-4000-8000-000000000008",
      clientMutationId: "86000000-0000-4000-8000-000000000008",
      campusId: primaryCampusId,
      authorId: manager.id,
      title: "Family sports morning schedule",
      paragraphs: [
        "Family sports morning begins at 8:30 AM with warm-up games on the main playground.",
        "This approved post is scheduled for a future release and should not appear in the public feed yet.",
      ],
      status: "PUBLISHED",
      publishAt: dateFromNow(now, 2 * DAY_MS),
      requiresApproval: true,
      createdAt: dateFromNow(now, -4 * HOUR_MS),
      audiences: [{ id: "81000000-0000-4000-8000-000000000008", type: "ALL" }],
      categoryIds: [categories[0].events],
      statusHistory: [
        {
          id: "83000000-0000-4000-8000-000000000018",
          previousStatus: null,
          newStatus: "DRAFT",
          changedById: manager.id,
          createdAt: dateFromNow(now, -4 * HOUR_MS),
        },
        {
          id: "83000000-0000-4000-8000-000000000019",
          previousStatus: "DRAFT",
          newStatus: "PENDING_REVIEW",
          changedById: manager.id,
          createdAt: dateFromNow(now, -3 * HOUR_MS),
        },
        {
          id: "83000000-0000-4000-8000-000000000020",
          previousStatus: "PENDING_REVIEW",
          newStatus: "PUBLISHED",
          changedById: manager.id,
          reason: "Approved and scheduled",
          createdAt: dateFromNow(now, -2 * HOUR_MS),
        },
      ],
      approval: {
        id: "82000000-0000-4000-8000-000000000007",
        submittedById: manager.id,
        submittedAt: dateFromNow(now, -3 * HOUR_MS),
        status: "APPROVED",
        reviewedById: manager.id,
        reviewedAt: dateFromNow(now, -2 * HOUR_MS),
        reviewNote: "Approved and scheduled",
      },
    },
    {
      id: "80000000-0000-4000-8000-000000000009",
      clientMutationId: "86000000-0000-4000-8000-000000000009",
      campusId: secondaryCampusId,
      authorId: manager.id,
      title: "Quan 2 campus weekly update",
      paragraphs: [
        "This campus publishes teacher updates immediately because approval is disabled in CMS settings.",
      ],
      status: "PUBLISHED",
      publishAt: dateFromNow(now, -DAY_MS),
      requiresApproval: false,
      createdAt: dateFromNow(now, -1.1 * DAY_MS),
      audiences: [{ id: "81000000-0000-4000-8000-000000000009", type: "ALL" }],
      categoryIds: [categories[1].announcements],
      statusHistory: [
        {
          id: "83000000-0000-4000-8000-000000000021",
          previousStatus: null,
          newStatus: "DRAFT",
          changedById: manager.id,
          createdAt: dateFromNow(now, -1.1 * DAY_MS),
        },
        {
          id: "83000000-0000-4000-8000-000000000022",
          previousStatus: "DRAFT",
          newStatus: "PUBLISHED",
          changedById: manager.id,
          reason: "Approval disabled for this campus",
          createdAt: dateFromNow(now, -DAY_MS),
        },
      ],
    },
    {
      id: "80000000-0000-4000-8000-000000000010",
      clientMutationId: "86000000-0000-4000-8000-000000000010",
      campusId: restrictedCampusId,
      authorId: manager.id,
      title: "Nam Do seasonal health notice",
      paragraphs: [
        "Please keep children home when they have a fever and notify the campus before the morning attendance check.",
        "Comments and reactions are disabled for this campus, allowing the engagement setting guards to be tested.",
      ],
      status: "PUBLISHED",
      publishAt: dateFromNow(now, -8 * HOUR_MS),
      requiresApproval: true,
      createdAt: dateFromNow(now, -10 * HOUR_MS),
      audiences: [{ id: "81000000-0000-4000-8000-000000000010", type: "ALL" }],
      categoryIds: [categories[2].health],
      statusHistory: [
        {
          id: "83000000-0000-4000-8000-000000000023",
          previousStatus: null,
          newStatus: "DRAFT",
          changedById: manager.id,
          createdAt: dateFromNow(now, -10 * HOUR_MS),
        },
        {
          id: "83000000-0000-4000-8000-000000000024",
          previousStatus: "DRAFT",
          newStatus: "PENDING_REVIEW",
          changedById: manager.id,
          createdAt: dateFromNow(now, -9 * HOUR_MS),
        },
        {
          id: "83000000-0000-4000-8000-000000000025",
          previousStatus: "PENDING_REVIEW",
          newStatus: "PUBLISHED",
          changedById: manager.id,
          reason: "Approved health guidance",
          createdAt: dateFromNow(now, -8 * HOUR_MS),
        },
      ],
      approval: {
        id: "82000000-0000-4000-8000-000000000008",
        submittedById: manager.id,
        submittedAt: dateFromNow(now, -9 * HOUR_MS),
        status: "APPROVED",
        reviewedById: manager.id,
        reviewedAt: dateFromNow(now, -8 * HOUR_MS),
        reviewNote: "Approved health guidance",
      },
    },
  ];

  for (const postSeed of postSeeds) {
    await seedPost(prisma, postSeed);
  }

  console.log(
    `Seeded CMS: ${categories.length * CATEGORY_SEEDS.length} categories, ${postSeeds.length} posts, 2 pending approvals.`,
  );
  console.log(
    `CMS demo identities: manager=${manager.clerkUid}, teacher=${teacher.clerkUid}, parent=${parent.clerkUid}`,
  );
}
