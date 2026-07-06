/**
 * Entity Factories for Tests
 * Provides factory functions to create domain entities with sensible defaults
 * for use in unit and integration tests.
 */

import { Campus } from "@/domain/campus/entities/campus.entity";
import {
  Staff,
  StaffTypeSnapshot,
} from "@/domain/user-management/entities/staff.entity";
import { Student } from "@/domain/user-management/entities/student.entity";
import { Guardian } from "@/domain/user-management/entities/guardian.entity";
import { Class } from "@/domain/class-management/entities/class.entity";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import {
  MealMenu,
  MealMenuConfig,
  MealMenuEntryInput,
} from "@/domain/meal-menu";
import {
  User,
  UserProfile,
  UserRoleAssignment,
} from "@/domain/user-management/user.entity";
import { Role } from "@/domain/user-management/role.entity";
import {
  Permission,
  PermissionEntity,
} from "@/domain/rbac/entities/permission.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { StudentPhase } from "@/domain/user-management/enums/student-phase.enum";
import { v4 as uuidv4 } from "uuid";

// Default IDs for testing (valid UUID v4 format)
export const DEFAULT_CAMPUS_ID_A = "11111111-1111-4111-a111-111111111111";
export const DEFAULT_CAMPUS_ID_B = "22222222-2222-4222-a222-222222222222";

/**
 * Create a Campus entity with defaults
 */
export function createCampus(
  overrides: Partial<{
    id: string;
    name: string;
    address: string | null;
    phoneNumber: string | null;
    isArchived: boolean;
  }> = {},
): Campus {
  return Campus.create(
    {
      name: overrides.name ?? "Test Campus",
      address: overrides.address ?? "123 Test Street",
      phoneNumber: overrides.phoneNumber ?? "+84901234567",
      isArchived: overrides.isArchived ?? false,
    },
    overrides.id ?? uuidv4(),
  );
}

/**
 * Create a Staff entity with defaults
 */
export function createStaff(
  overrides: Partial<{
    id: string;
    campusId: string;
    staffCode: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    staffTypes: StaffTypeSnapshot[];
    address: string | null;
    dateOfBirth: Date | null;
    gender: Gender | null;
    userId: string | null;
    isArchived: boolean;
  }> = {},
): Staff {
  const uniqueSuffix = uuidv4().slice(0, 8);
  const sequence = Math.floor(1 + Math.random() * 999998);
  const year = new Date().getFullYear();
  return Staff.create(
    {
      campusId: overrides.campusId ?? DEFAULT_CAMPUS_ID_A,
      staffCode:
        overrides.staffCode ??
        `ST-${year}-${String(sequence).padStart(6, "0")}`,
      fullName: overrides.fullName ?? "Test Staff",
      email: overrides.email ?? `staff-${uniqueSuffix}@test.com`,
      phoneNumber:
        overrides.phoneNumber ??
        `+8490${Math.floor(1000000 + Math.random() * 9000000)}`,
      staffTypes: overrides.staffTypes ?? [],
      address: overrides.address ?? null,
      dateOfBirth: overrides.dateOfBirth ?? null,
      gender: overrides.gender ?? null,
      userId: overrides.userId ?? null,
      isArchived: overrides.isArchived ?? false,
    },
    overrides.id ?? uuidv4(),
  );
}

/**
 * Create a Student entity with defaults
 */
export function createStudent(
  overrides: Partial<{
    id: string;
    campusId: string;
    studentCode: string;
    fullName: string;
    email: string | null;
    phoneNumber: string | null;
    address: string | null;
    dateOfBirth: Date | null;
    nickname: string | null;
    gender: Gender | null;
    isArchived: boolean;
    phase: StudentPhase;
  }> = {},
): Student {
  const uniqueSuffix = uuidv4().slice(0, 8);
  return Student.create(
    {
      campusId: overrides.campusId ?? DEFAULT_CAMPUS_ID_A,
      studentCode: overrides.studentCode ?? `STU-${uniqueSuffix}`,
      fullName: overrides.fullName ?? "Test Student",
      email: overrides.email ?? null,
      phoneNumber: overrides.phoneNumber ?? null,
      address: overrides.address ?? null,
      dateOfBirth: overrides.dateOfBirth ?? null,
      nickname: overrides.nickname ?? null,
      gender: overrides.gender ?? null,
      isArchived: overrides.isArchived ?? false,
      phase: overrides.phase,
    },
    overrides.id ?? uuidv4(),
  );
}

/**
 * Create a Guardian entity with defaults
 */
export function createGuardian(
  overrides: Partial<{
    id: string;
    campusId: string;
    fullName: string;
    email: string | null;
    phoneNumber: string;
    address: string | null;
    dateOfBirth: Date | null;
    gender: Gender | null;
    occupation: string | null;
    workAddress: string | null;
    userId: string | null;
    isArchived: boolean;
  }> = {},
): Guardian {
  const uniqueSuffix = uuidv4().slice(0, 8);
  return Guardian.create(
    {
      campusId: overrides.campusId ?? DEFAULT_CAMPUS_ID_A,
      fullName: overrides.fullName ?? "Test Guardian",
      email: overrides.email ?? `guardian-${uniqueSuffix}@test.com`,
      phoneNumber:
        overrides.phoneNumber ??
        `+8490${Math.floor(1000000 + Math.random() * 9000000)}`,
      address: overrides.address ?? null,
      dateOfBirth: overrides.dateOfBirth ?? null,
      gender: overrides.gender ?? null,
      occupation: overrides.occupation ?? null,
      workAddress: overrides.workAddress ?? null,
      userId: overrides.userId ?? null,
      isArchived: overrides.isArchived ?? false,
    },
    overrides.id ?? uuidv4(),
  );
}

/**
 * Create a Class entity with defaults
 *
 * Default-attaches a SchoolYear relation with a wide date range
 * (2020-01-01 to 2030-12-31) so use cases that validate enrollmentDate
 * against `class.schoolYear.startDate`/`endDate` can run with realistic
 * test data without each spec needing to wire one up.
 */
export function createClass(
  overrides: Partial<{
    id: string;
    campusId: string;
    name: string;
    gradeLevelId: string;
    schoolYearId: string;
    description: string | null;
    schoolYear: SchoolYear;
  }> = {},
): Class {
  const campusId = overrides.campusId ?? DEFAULT_CAMPUS_ID_A;
  const schoolYearId =
    overrides.schoolYearId ?? overrides.schoolYear?.id ?? "school-year-1";
  const schoolYear =
    overrides.schoolYear ??
    SchoolYear.create(
      {
        campusId,
        name: "Test School Year",
        startDate: new Date("2020-01-01T00:00:00.000Z"),
        endDate: new Date("2030-12-31T00:00:00.000Z"),
      },
      schoolYearId,
    );
  return Class.create(
    {
      campusId,
      name: overrides.name ?? "Test Class",
      gradeLevelId: overrides.gradeLevelId ?? "grade-level-1",
      schoolYearId,
      description: overrides.description ?? null,
      schoolYear,
    },
    overrides.id ?? uuidv4(),
  );
}

/**
 * Create a GradeLevel entity with defaults
 */
export function createGradeLevel(
  overrides: Partial<{
    id: string;
    campusId: string;
    name: string;
    order: number;
  }> = {},
): GradeLevel {
  return GradeLevel.create(
    {
      campusId: overrides.campusId ?? DEFAULT_CAMPUS_ID_A,
      name: overrides.name ?? "Test Grade Level",
      order: overrides.order ?? 1,
    },
    overrides.id ?? uuidv4(),
  );
}

/**
 * Create a SchoolYear entity with defaults
 */
export function createSchoolYear(
  overrides: Partial<{
    id: string;
    campusId: string;
    name: string;
    startDate: Date;
    endDate: Date;
  }> = {},
): SchoolYear {
  const currentYear = new Date().getFullYear();
  return SchoolYear.create(
    {
      campusId: overrides.campusId ?? DEFAULT_CAMPUS_ID_A,
      name: overrides.name ?? `${currentYear}-${currentYear + 1}`,
      startDate: overrides.startDate ?? new Date(`${currentYear}-09-01`),
      endDate: overrides.endDate ?? new Date(`${currentYear + 1}-06-30`),
    },
    overrides.id ?? uuidv4(),
  );
}

/**
 * Create a Permission entity with defaults
 */
export function createPermission(
  overrides: Partial<{
    id: string;
    module: string;
    description: string | null;
  }> = {},
): Permission {
  const module = overrides.module ?? "student";
  const id = overrides.id ?? `${module}.read`;
  return PermissionEntity.create({
    id,
    module,
    description: overrides.description ?? null,
  });
}

/**
 * Create a Role with defaults
 */
export function createRole(
  overrides: Partial<{
    id: string;
    name: string;
    description: string | null;
    campusId: string | null;
    isSystemDefault: boolean;
    isSystemRole: boolean;
    permissions: Permission[];
  }> = {},
): Role {
  return {
    id: overrides.id ?? uuidv4(),
    name: overrides.name ?? "Test Role",
    description: overrides.description ?? null,
    campusId: overrides.campusId ?? null, // null = global role
    isSystemDefault: overrides.isSystemDefault ?? false,
    isSystemRole: overrides.isSystemRole ?? false,
    permissions: overrides.permissions ?? [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Create a User entity with defaults
 */
export function createUser(
  overrides: Partial<{
    id: string;
    clerkUid: string;
    name: string;
    email: string;
    isActive: boolean;
    roleAssignments: UserRoleAssignment[];
    profile: UserProfile | null;
    profiles: UserProfile[];
  }> = {},
): User {
  const uniqueSuffix = uuidv4().slice(0, 8);
  const user = User.create(
    {
      clerkUid: overrides.clerkUid ?? `user_${uniqueSuffix}`,
      name: overrides.name ?? "Test User",
      email: overrides.email ?? `user-${uniqueSuffix}@test.com`,
      isActive: overrides.isActive ?? true,
    },
    overrides.id ?? uuidv4(),
  );

  // If relation-shaped fields are provided, reconstitute with them
  if (
    overrides.roleAssignments ||
    overrides.profile !== undefined ||
    overrides.profiles
  ) {
    return User.reconstitute(
      {
        clerkUid: user.clerkUid,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        roleAssignments: overrides.roleAssignments ?? [],
        profile: overrides.profile,
        profiles: overrides.profiles,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      user.id,
    );
  }

  return user;
}

/**
 * Create a UserRoleAssignment
 */
export function createRoleAssignment(
  role: Role,
  campusId: string | null = null,
): UserRoleAssignment {
  return {
    role,
    campusId,
    assignedAt: new Date(),
  };
}

/**
 * Create a user with specific roles for specific campuses
 */
export function createUserWithCampusRoles(
  userId: string,
  roleAssignments: { role: Role; campusId: string | null }[],
): User {
  const assignments: UserRoleAssignment[] = roleAssignments.map(
    ({ role, campusId }) => ({
      role,
      campusId,
      assignedAt: new Date(),
    }),
  );

  return User.reconstitute(
    {
      clerkUid: `user_${userId.slice(0, 8)}`,
      name: "Test User",
      email: `user-${userId.slice(0, 8)}@test.com`,
      isActive: true,
      roleAssignments: assignments,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    userId,
  );
}

/**
 * Create a MealMenu entity with defaults
 */
export function createMealMenu(
  overrides: Partial<{
    id: string;
    campusId: string;
    gradeLevelId: string | null;
    weekStartDate: Date;
    title: string | null;
    days: number[];
    mealSlots: string[];
    entries: MealMenuEntryInput[];
    isArchived: boolean;
  }> = {},
): MealMenu {
  return MealMenu.create(
    {
      campusId: overrides.campusId ?? DEFAULT_CAMPUS_ID_A,
      gradeLevelId: overrides.gradeLevelId ?? null,
      weekStartDate:
        overrides.weekStartDate ?? new Date("2026-06-01T00:00:00.000Z"),
      title: overrides.title ?? "Weekly Menu",
      days: overrides.days ?? [1, 2, 3, 4, 5],
      mealSlots: overrides.mealSlots ?? ["Breakfast", "Lunch", "Afternoon"],
      entries: overrides.entries ?? [
        { dayOfWeek: 1, slot: "Breakfast", description: "Oatmeal" },
      ],
      isArchived: overrides.isArchived ?? false,
    },
    overrides.id ?? uuidv4(),
  );
}

/**
 * Create a MealMenuConfig entity with defaults
 */
export function createMealMenuConfig(
  overrides: Partial<{
    id: string;
    campusId: string;
    operatingDays: number[];
    defaultMealSlots: string[];
  }> = {},
): MealMenuConfig {
  return MealMenuConfig.create(
    {
      campusId: overrides.campusId ?? DEFAULT_CAMPUS_ID_A,
      operatingDays: overrides.operatingDays ?? [1, 2, 3, 4, 5],
      defaultMealSlots: overrides.defaultMealSlots ?? [
        "Breakfast",
        "Lunch",
        "Afternoon",
      ],
    },
    overrides.id ?? uuidv4(),
  );
}
