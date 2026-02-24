import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// UUID Generation Helper
// ============================================================================

/**
 * Generate a deterministic UUID based on prefix and index
 * Format: {prefix}{padded_index}-{suffix}
 */
function generateUUID(prefix: string, index: number): string {
  const paddedIndex = index.toString().padStart(4, "0");
  // Format: xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx (valid UUID v4)
  const base = prefix.padEnd(8, "0").substring(0, 8);
  return `${base}-${paddedIndex.substring(0, 4)}-4000-8000-${paddedIndex}00000000`.substring(
    0,
    36,
  );
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  CAMPUSES: 3,
  GRADES_PER_CAMPUS: 5,
  CLASSES_PER_GRADE: 5,
  STUDENTS_PER_CLASS: 5,
  GUARDIANS_PER_STUDENT: 2,
  STAFF_PER_CAMPUS: 10,
};

// Grade names
const GRADE_NAMES = ["Pre-K", "K1", "K2", "K3", "K4"];

// Class suffixes
const CLASS_SUFFIXES = ["A", "B", "C", "D", "E"];

// Staff types
const STAFF_TYPES = [
  "Principal",
  "Teacher",
  "Teaching Assistant",
  "Administrative Staff",
];

// Vietnamese first names
const FIRST_NAMES = [
  "An",
  "Bao",
  "Chi",
  "Dat",
  "Em",
  "Gia",
  "Hai",
  "Khanh",
  "Lan",
  "Minh",
  "Nam",
  "Oanh",
  "Phu",
  "Quang",
  "Son",
  "Trang",
  "Uyen",
  "Van",
  "Xuan",
  "Yen",
  "Anh",
  "Binh",
  "Cuong",
  "Dung",
  "Giang",
  "Hoa",
  "Hung",
  "Linh",
  "Long",
  "Mai",
  "Nga",
  "Phong",
  "Quy",
  "Tam",
  "Thao",
  "Tuan",
  "Vinh",
  "Vy",
  "Hieu",
  "Duc",
];

// Vietnamese last names
const LAST_NAMES = [
  "Nguyen",
  "Tran",
  "Le",
  "Pham",
  "Hoang",
  "Huynh",
  "Phan",
  "Vu",
  "Vo",
  "Dang",
  "Bui",
  "Do",
  "Ho",
  "Ngo",
  "Duong",
  "Ly",
  "Trinh",
  "Lam",
  "Ta",
  "Cao",
];

// ============================================================================
// UUID Constants for System Entities
// ============================================================================

const SYSTEM_IDS = {
  SUPER_ADMIN_ROLE: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  SUPER_ADMIN_USER: "10000000-1000-4000-8000-100000000001",
  // Your actual Clerk UID for super admin access
  SUPER_ADMIN_CLERK_UID: "user_37qegUeRM0p7Rya0JVgknCu5ckB",
};

// ============================================================================
// Helper Functions
// ============================================================================

function randomName(): { firstName: string; lastName: string } {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return { firstName, lastName };
}

function generatePhone(index: number): string {
  return `+1555555${index.toString().padStart(4, "0")}`;
}

function generateEmail(prefix: string, index: number, domain: string): string {
  return `${prefix}${index}@${domain}`;
}

function randomDate(startYear: number, endYear: number): Date {
  const start = new Date(startYear, 0, 1);
  const end = new Date(endYear, 11, 31);
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

function randomGender(): string {
  return Math.random() > 0.5 ? "MALE" : "FEMALE";
}

// ============================================================================
// ID Generators for each entity type
// Valid UUID v4 format: xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx (hex only)
// ============================================================================

function makeUUID(typeCode: number, index: number): string {
  const typeHex = typeCode.toString(16).padStart(8, "0");
  const indexHex = index.toString(16).padStart(4, "0");
  const suffix = index.toString(16).padStart(12, "0");
  return `${typeHex}-${indexHex}-4000-8000-${suffix}`;
}

const IDS = {
  campus: (index: number) => makeUUID(0x10000000, index),
  gradeLevel: (campusIndex: number, gradeIndex: number) =>
    makeUUID(0x20000000 + campusIndex * 0x1000, gradeIndex),
  schoolYear: (campusIndex: number, yearIndex: number) =>
    makeUUID(0x30000000 + campusIndex * 0x1000, yearIndex),
  class: (campusIndex: number, gradeIndex: number, classIndex: number) =>
    makeUUID(
      0x40000000 + campusIndex * 0x10000 + gradeIndex * 0x100,
      classIndex,
    ),
  student: (campusIndex: number, studentIndex: number) =>
    makeUUID(0x50000000 + campusIndex * 0x10000, studentIndex),
  guardian: (campusIndex: number, guardianIndex: number) =>
    makeUUID(0x60000000 + campusIndex * 0x10000, guardianIndex),
  staff: (campusIndex: number, staffIndex: number) =>
    makeUUID(0x70000000 + campusIndex * 0x1000, staffIndex),
  user: (type: string, index: number) => {
    const typeCode =
      type === "staff"
        ? 0x80000000
        : type === "guardian"
          ? 0x81000000
          : 0x82000000;
    return makeUUID(typeCode, index);
  },
  role: (campusIndex: number, roleIndex: number) =>
    makeUUID(0x90000000 + campusIndex * 0x1000, roleIndex),
  staffType: (campusIndex: number, typeIndex: number) =>
    makeUUID(0xa0000000 + campusIndex * 0x1000, typeIndex),
  enrollment: (campusIndex: number, enrollmentIndex: number) =>
    makeUUID(0xb0000000 + campusIndex * 0x10000, enrollmentIndex),
  userRole: (index: number) => makeUUID(0xc0000000, index),
  subject: (campusIndex: number, subjectIndex: number) =>
    makeUUID(0xd0000000 + campusIndex * 0x1000, subjectIndex),
  campusSetting: (campusIndex: number) => makeUUID(0xe0000000, campusIndex),
  postCategory: (campusIndex: number, categoryIndex: number) =>
    makeUUID(0xf0000000 + campusIndex * 0x1000, categoryIndex),
  post: (campusIndex: number, postIndex: number) =>
    makeUUID(0xf1000000 + campusIndex * 0x1000, postIndex),
  postAudience: (
    campusIndex: number,
    postIndex: number,
    audienceIndex: number,
  ) =>
    makeUUID(
      0xf2000000 + campusIndex * 0x10000 + postIndex * 0x100,
      audienceIndex,
    ),
};

// ============================================================================
// Campus Data
// ============================================================================

const CAMPUS_DATA = [
  {
    name: "Kindercare My Dinh",
    address: "My Dinh, Ha Noi",
    phone: "+15555550100",
  },
  {
    name: "Kindercare Quan 2",
    address: "Quan 2, Ho Chi Minh",
    phone: "+15555550101",
  },
  {
    name: "Kindercare Nam Do",
    address: "Nam Do, Ha Noi",
    phone: "+15555550102",
  },
];

// ============================================================================
// Seed Functions
// ============================================================================

async function seedGuardianRelationships() {
  console.log("Seeding guardian relationships...");

  const relationships = [
    {
      id: "FATHER",
      name: "Father",
      description: "Biological or adoptive father",
    },
    {
      id: "MOTHER",
      name: "Mother",
      description: "Biological or adoptive mother",
    },
    {
      id: "GRANDFATHER",
      name: "Grandfather",
      description: "Paternal or maternal grandfather",
    },
    {
      id: "GRANDMOTHER",
      name: "Grandmother",
      description: "Paternal or maternal grandmother",
    },
    { id: "UNCLE", name: "Uncle", description: "Uncle of the student" },
    { id: "AUNT", name: "Aunt", description: "Aunt of the student" },
    { id: "SIBLING", name: "Sibling", description: "Brother or sister" },
    {
      id: "LEGAL_GUARDIAN",
      name: "Legal Guardian",
      description: "Court-appointed legal guardian",
    },
    { id: "OTHER", name: "Other", description: "Other relationship" },
  ];

  for (const rel of relationships) {
    await prisma.guardianRelationship.upsert({
      where: { id: rel.id },
      update: {},
      create: rel,
    });
  }

  console.log(`  Created ${relationships.length} guardian relationships`);
}

async function seedPermissions() {
  console.log("Seeding permissions...");

  const permissions = [
    // Campus Management
    { id: "campus:read", module: "campus", description: "View campus details" },
    {
      id: "campus:write",
      module: "campus",
      description: "Create/update campus",
    },
    { id: "campus:delete", module: "campus", description: "Delete campus" },
    // User Management
    { id: "user:read", module: "user", description: "View users" },
    { id: "user:write", module: "user", description: "Create/update users" },
    { id: "user:delete", module: "user", description: "Delete users" },
    // Role Management
    { id: "role:read", module: "role", description: "View roles" },
    { id: "role:write", module: "role", description: "Create/update roles" },
    { id: "role:delete", module: "role", description: "Delete roles" },
    { id: "role:assign", module: "role", description: "Assign roles to users" },
    // Staff Management
    { id: "staff:read", module: "staff", description: "View staff members" },
    { id: "staff:write", module: "staff", description: "Create/update staff" },
    { id: "staff:delete", module: "staff", description: "Delete staff" },
    // Student Management
    { id: "student:read", module: "student", description: "View students" },
    {
      id: "student:write",
      module: "student",
      description: "Create/update students",
    },
    { id: "student:delete", module: "student", description: "Delete students" },
    // Guardian Management
    { id: "guardian:read", module: "guardian", description: "View guardians" },
    {
      id: "guardian:write",
      module: "guardian",
      description: "Create/update guardians",
    },
    {
      id: "guardian:delete",
      module: "guardian",
      description: "Delete guardians",
    },
    // Class Management
    { id: "class:read", module: "class", description: "View classes" },
    {
      id: "class:write",
      module: "class",
      description: "Create/update classes",
    },
    { id: "class:delete", module: "class", description: "Delete classes" },
    // Attendance
    {
      id: "attendance:read",
      module: "attendance",
      description: "View attendance records",
    },
    {
      id: "attendance:write",
      module: "attendance",
      description: "Record attendance",
    },
    // Post/CMS Management
    { id: "post:read", module: "post", description: "View posts" },
    {
      id: "post:write",
      module: "post",
      description: "Create/update own posts",
    },
    { id: "post:delete", module: "post", description: "Delete own posts" },
    {
      id: "post:publish",
      module: "post",
      description: "Publish posts directly",
    },
    { id: "post:approve", module: "post", description: "Approve/reject posts" },
    { id: "post:pin", module: "post", description: "Pin/unpin posts" },
    // Comments
    { id: "comment:read", module: "comment", description: "View comments" },
    {
      id: "comment:write",
      module: "comment",
      description: "Create/edit own comments",
    },
    {
      id: "comment:delete",
      module: "comment",
      description: "Delete any comments",
    },
    // File Management
    { id: "file:read", module: "file", description: "View files" },
    { id: "file:upload", module: "file", description: "Upload files" },
    { id: "file:delete", module: "file", description: "Delete files" },
    // Settings
    { id: "settings:read", module: "settings", description: "View settings" },
    {
      id: "settings:write",
      module: "settings",
      description: "Modify settings",
    },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { id: perm.id },
      update: {},
      create: perm,
    });
  }

  console.log(`  Created ${permissions.length} permissions`);
}

async function seedCampuses() {
  console.log("Seeding campuses...");

  let count = 0;
  for (let i = 0; i < CONFIG.CAMPUSES; i++) {
    await prisma.campus.upsert({
      where: { id: IDS.campus(i) },
      update: {},
      create: {
        id: IDS.campus(i),
        name: CAMPUS_DATA[i].name,
        address: CAMPUS_DATA[i].address,
        phoneNumber: CAMPUS_DATA[i].phone,
        isActive: true,
      },
    });
    count++;
  }

  console.log(`  Created ${count} campuses`);
}

async function seedSuperAdmin() {
  console.log("Seeding super admin...");

  // Create super admin user with your Clerk UID
  await prisma.user.upsert({
    where: { id: SYSTEM_IDS.SUPER_ADMIN_USER },
    update: { clerkUid: SYSTEM_IDS.SUPER_ADMIN_CLERK_UID },
    create: {
      id: SYSTEM_IDS.SUPER_ADMIN_USER,
      clerkUid: SYSTEM_IDS.SUPER_ADMIN_CLERK_UID,
      isActive: true,
    },
  });

  // Create super admin role (global role with isSystemRole=true for admin bypass)
  await prisma.role.upsert({
    where: { id: SYSTEM_IDS.SUPER_ADMIN_ROLE },
    update: { isSystemRole: true, isSystemDefault: true },
    create: {
      id: SYSTEM_IDS.SUPER_ADMIN_ROLE,
      name: "Super Admin",
      description:
        "Global system administrator with full access to all campuses",
      campusId: null,
      isSystemDefault: true,
      isSystemRole: true,
      permissions: {},
    },
  });

  // Assign super admin role
  await prisma.userRole.upsert({
    where: { id: IDS.userRole(0) },
    update: {},
    create: {
      id: IDS.userRole(0),
      userId: SYSTEM_IDS.SUPER_ADMIN_USER,
      roleId: SYSTEM_IDS.SUPER_ADMIN_ROLE,
      campusId: null,
    },
  });

  console.log("  Created super admin user and role");
}

/**
 * Create a Staff profile for the super admin user
 * This must be called after campuses and staff types are seeded
 */
async function seedSuperAdminStaffProfile(
  campusId: string,
  staffTypeId: string,
) {
  console.log("Creating staff profile for super admin...");

  const superAdminStaffId = "10000000-1000-4000-8000-100000000002";

  await prisma.staff.upsert({
    where: { id: superAdminStaffId },
    update: {
      userId: SYSTEM_IDS.SUPER_ADMIN_USER,
    },
    create: {
      id: superAdminStaffId,
      campusId: campusId,
      fullName: "System Administrator",
      email: "admin@kindercare.vn",
      phoneNumber: "+15555550001",
      gender: "MALE",
      staffTypeId: staffTypeId,
      userId: SYSTEM_IDS.SUPER_ADMIN_USER,
      startDate: new Date("2024-01-01"),
    },
  });

  console.log("  Created staff profile for super admin");
}

async function seedRolesForCampus(campusId: string, campusIndex: number) {
  const roles = [
    {
      name: "Campus Admin",
      description: "Campus administrator with full campus access",
      index: 0,
    },
    {
      name: "Teacher",
      description: "Teacher with class management and post creation access",
      index: 1,
    },
    {
      name: "Staff",
      description: "General staff with limited access",
      index: 2,
    },
  ];

  const createdRoles: { [key: string]: string } = {};

  for (const role of roles) {
    const roleId = IDS.role(campusIndex, role.index);
    await prisma.role.upsert({
      where: { id: roleId },
      update: {},
      create: {
        id: roleId,
        name: role.name,
        description: role.description,
        campusId: campusId,
        isSystemDefault: true,
        isSystemRole: false,
        permissions: {},
      },
    });
    createdRoles[role.name] = roleId;
  }

  return createdRoles;
}

async function seedStaffTypesForCampus(
  campusId: string,
  campusIndex: number,
  roles: { [key: string]: string },
) {
  const staffTypes = [
    {
      name: "Principal",
      description: "School principal",
      roleKey: "Campus Admin",
      index: 0,
    },
    {
      name: "Teacher",
      description: "Classroom teacher",
      roleKey: "Teacher",
      index: 1,
    },
    {
      name: "Teaching Assistant",
      description: "Teaching assistant",
      roleKey: "Staff",
      index: 2,
    },
    {
      name: "Administrative Staff",
      description: "Administrative staff member",
      roleKey: "Staff",
      index: 3,
    },
  ];

  const createdStaffTypes: { [key: string]: string } = {};

  for (const st of staffTypes) {
    const staffTypeId = IDS.staffType(campusIndex, st.index);
    await prisma.staffType.upsert({
      where: { id: staffTypeId },
      update: {},
      create: {
        id: staffTypeId,
        campusId: campusId,
        name: st.name,
        description: st.description,
        defaultRoleId: roles[st.roleKey],
        order: st.index,
      },
    });
    createdStaffTypes[st.name] = staffTypeId;
  }

  return createdStaffTypes;
}

async function seedSchoolYearsForCampus(campusId: string, campusIndex: number) {
  const schoolYears = [
    {
      name: "2024-2025",
      startDate: new Date("2024-09-01"),
      endDate: new Date("2025-06-30"),
      index: 0,
    },
    {
      name: "2025-2026",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-06-30"),
      index: 1,
    },
  ];

  let currentSchoolYearId = "";
  const today = new Date();

  for (const sy of schoolYears) {
    const schoolYearId = IDS.schoolYear(campusIndex, sy.index);
    await prisma.schoolYear.upsert({
      where: { id: schoolYearId },
      update: {},
      create: {
        id: schoolYearId,
        campusId: campusId,
        name: sy.name,
        startDate: sy.startDate,
        endDate: sy.endDate,
        isArchived: false,
      },
    });

    // Pick the school year that contains today's date
    if (today >= sy.startDate && today <= sy.endDate) {
      currentSchoolYearId = schoolYearId;
    }
  }

  // Fallback to first school year if today doesn't fall in any
  if (!currentSchoolYearId) {
    currentSchoolYearId = IDS.schoolYear(campusIndex, 0);
  }

  return currentSchoolYearId;
}

async function seedSubjectsForCampus(campusId: string, campusIndex: number) {
  const subjects = [
    { name: "Homeroom", index: 0 },
    { name: "English", index: 1 },
    { name: "Music", index: 2 },
    { name: "Art", index: 3 },
    { name: "Physical Education", index: 4 },
  ];

  const createdSubjects: { [key: string]: string } = {};

  for (const subj of subjects) {
    const subjectId = IDS.subject(campusIndex, subj.index);
    await prisma.subject.upsert({
      where: { id: subjectId },
      update: {},
      create: {
        id: subjectId,
        campusId: campusId,
        name: subj.name,
      },
    });
    createdSubjects[subj.name] = subjectId;
  }

  return createdSubjects;
}

async function seedGradeLevelsForCampus(campusId: string, campusIndex: number) {
  const gradeLevelIds: string[] = [];

  for (let i = 0; i < CONFIG.GRADES_PER_CAMPUS; i++) {
    const gradeLevelId = IDS.gradeLevel(campusIndex, i);
    await prisma.gradeLevel.upsert({
      where: { id: gradeLevelId },
      update: {},
      create: {
        id: gradeLevelId,
        campusId: campusId,
        name: GRADE_NAMES[i],
        order: i + 1,
      },
    });
    gradeLevelIds.push(gradeLevelId);
  }

  return gradeLevelIds;
}

async function seedClassesForGrade(
  campusId: string,
  campusIndex: number,
  gradeLevelId: string,
  gradeIndex: number,
  schoolYearId: string,
) {
  const classIds: string[] = [];

  for (let i = 0; i < CONFIG.CLASSES_PER_GRADE; i++) {
    const classId = IDS.class(campusIndex, gradeIndex, i);
    const className = `${GRADE_NAMES[gradeIndex]} Class ${CLASS_SUFFIXES[i]}`;

    await prisma.class.upsert({
      where: { id: classId },
      update: {},
      create: {
        id: classId,
        campusId: campusId,
        name: className,
        description: `${className} for school year`,
        gradeLevelId: gradeLevelId,
        schoolYearId: schoolYearId,
      },
    });
    classIds.push(classId);
  }

  return classIds;
}

async function seedStaffForCampus(
  campusId: string,
  campusIndex: number,
  staffTypes: { [key: string]: string },
  roles: { [key: string]: string },
) {
  const staffIds: string[] = [];
  let userRoleIndex = campusIndex * 100 + 10; // Start after super admin

  for (let i = 0; i < CONFIG.STAFF_PER_CAMPUS; i++) {
    const staffId = IDS.staff(campusIndex, i);
    const userId = IDS.user("staff", campusIndex * 100 + i);
    const { firstName, lastName } = randomName();
    const fullName = `${lastName} ${firstName}`;

    // Determine staff type: first is principal, next 5 are teachers, rest are assistants/admin
    let staffTypeKey: string;
    let roleKey: string;
    if (i === 0) {
      staffTypeKey = "Principal";
      roleKey = "Campus Admin";
    } else if (i < 6) {
      staffTypeKey = "Teacher";
      roleKey = "Teacher";
    } else if (i < 8) {
      staffTypeKey = "Teaching Assistant";
      roleKey = "Staff";
    } else {
      staffTypeKey = "Administrative Staff";
      roleKey = "Staff";
    }

    // Create user for staff
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        clerkUid: `user_staff_${campusIndex}_${i}`,
        isActive: true,
      },
    });

    // Assign role to user
    await prisma.userRole.upsert({
      where: { id: IDS.userRole(userRoleIndex) },
      update: {},
      create: {
        id: IDS.userRole(userRoleIndex),
        userId: userId,
        roleId: roles[roleKey],
        campusId: campusId,
      },
    });
    userRoleIndex++;

    // Create staff record
    await prisma.staff.upsert({
      where: { id: staffId },
      update: {},
      create: {
        id: staffId,
        campusId: campusId,
        fullName: fullName,
        email: generateEmail("staff", campusIndex * 100 + i, "kindercare.vn"),
        phoneNumber: generatePhone(1000 + campusIndex * 100 + i),
        gender: randomGender(),
        staffTypeId: staffTypes[staffTypeKey],
        userId: userId,
        startDate: randomDate(2020, 2024),
      },
    });

    staffIds.push(staffId);
  }

  return staffIds;
}

async function seedStudentsAndGuardiansForClass(
  campusId: string,
  campusIndex: number,
  classId: string,
  classIndex: number,
  gradeIndex: number,
) {
  const studentIds: string[] = [];
  const guardianIds: string[] = [];

  // Calculate global indices for this class
  const classGlobalIndex = gradeIndex * CONFIG.CLASSES_PER_GRADE + classIndex;
  const studentStartIndex = classGlobalIndex * CONFIG.STUDENTS_PER_CLASS;
  const guardianStartIndex = studentStartIndex * CONFIG.GUARDIANS_PER_STUDENT;

  for (let s = 0; s < CONFIG.STUDENTS_PER_CLASS; s++) {
    const studentGlobalIndex = studentStartIndex + s;
    const studentId = IDS.student(campusIndex, studentGlobalIndex);
    const { firstName, lastName } = randomName();
    const fullName = `${lastName} ${firstName}`;

    // Create student
    await prisma.student.upsert({
      where: { id: studentId },
      update: {},
      create: {
        id: studentId,
        campusId: campusId,
        studentCode: `STU-${campusIndex + 1}-${(studentGlobalIndex + 1).toString().padStart(4, "0")}`,
        fullName: fullName,
        dateOfBirth: randomDate(2018, 2022),
        gender: randomGender(),
        nickname: firstName,
        status: "ACTIVE",
      },
    });
    studentIds.push(studentId);

    // Create enrollment
    const enrollmentId = IDS.enrollment(campusIndex, studentGlobalIndex);
    await prisma.enrollment.upsert({
      where: { id: enrollmentId },
      update: {},
      create: {
        id: enrollmentId,
        classId: classId,
        studentId: studentId,
        enrollmentDate: new Date("2024-09-01"),
        note: "Regular enrollment",
      },
    });

    // Create guardians for this student
    for (let g = 0; g < CONFIG.GUARDIANS_PER_STUDENT; g++) {
      const guardianGlobalIndex =
        guardianStartIndex + s * CONFIG.GUARDIANS_PER_STUDENT + g;
      const guardianId = IDS.guardian(campusIndex, guardianGlobalIndex);
      const { firstName: gFirstName, lastName: gLastName } = randomName();
      const guardianFullName = `${gLastName} ${gFirstName}`;
      const gender = g === 0 ? "MALE" : "FEMALE";
      const relationship = g === 0 ? "FATHER" : "MOTHER";

      // Create guardian
      await prisma.guardian.upsert({
        where: { id: guardianId },
        update: {},
        create: {
          id: guardianId,
          campusId: campusId,
          fullName: guardianFullName,
          email: generateEmail(
            "guardian",
            campusIndex * 10000 + guardianGlobalIndex,
            "gmail.com",
          ),
          phoneNumber: generatePhone(
            5000 + campusIndex * 1000 + guardianGlobalIndex,
          ),
          gender: gender,
          occupation: g === 0 ? "Engineer" : "Teacher",
        },
      });
      guardianIds.push(guardianId);

      // Create guardian-student relationship
      await prisma.guardianStudent.upsert({
        where: {
          studentId_guardianId: {
            studentId: studentId,
            guardianId: guardianId,
          },
        },
        update: {},
        create: {
          studentId: studentId,
          guardianId: guardianId,
          guardianRelationshipId: relationship,
        },
      });
    }
  }

  return { studentIds, guardianIds };
}

async function seedCampusSettings(campusId: string, campusIndex: number) {
  await prisma.campusSetting.upsert({
    where: { campusId: campusId },
    update: {},
    create: {
      id: IDS.campusSetting(campusIndex),
      campusId: campusId,
      requireTeacherApproval: true,
      maxPinnedPosts: 3,
      allowParentComments: true,
      allowReactions: true,
    },
  });
}

async function seedPostCategoriesForCampus(
  campusId: string,
  campusIndex: number,
) {
  const categories = [
    { name: "Announcement", color: "#EF4444", icon: "megaphone", order: 1 },
    { name: "Event", color: "#3B82F6", icon: "calendar", order: 2 },
    { name: "Newsletter", color: "#10B981", icon: "newspaper", order: 3 },
    { name: "Class Activity", color: "#F59E0B", icon: "sparkles", order: 4 },
  ];

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    await prisma.postCategory.upsert({
      where: { id: IDS.postCategory(campusIndex, i) },
      update: {},
      create: {
        id: IDS.postCategory(campusIndex, i),
        campusId: campusId,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        order: cat.order,
        isActive: true,
      },
    });
  }
}

async function seedPostsForCampus(
  campusId: string,
  campusIndex: number,
  authorId: string,
  classIds: string[],
) {
  // Sample posts with different statuses and audience types
  const posts = [
    {
      title: "Welcome to the New School Year!",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "We are excited to welcome all students and families to the new school year. This year promises to be filled with exciting learning opportunities and memorable experiences.",
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Please make sure to check the school calendar for important dates and events. We look forward to a wonderful year together!",
              },
            ],
          },
        ],
      },
      contentText:
        "We are excited to welcome all students and families to the new school year. This year promises to be filled with exciting learning opportunities and memorable experiences. Please make sure to check the school calendar for important dates and events. We look forward to a wonderful year together!",
      status: "PUBLISHED",
      audienceType: "ALL",
      categoryIndex: 0, // Announcement
    },
    {
      title: "Parent-Teacher Conference Schedule",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Dear Parents, we will be holding parent-teacher conferences next week. Please sign up for a time slot that works best for you.",
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "This is a great opportunity to discuss your child's progress and set goals for the rest of the year.",
              },
            ],
          },
        ],
      },
      contentText:
        "Dear Parents, we will be holding parent-teacher conferences next week. Please sign up for a time slot that works best for you. This is a great opportunity to discuss your child's progress and set goals for the rest of the year.",
      status: "PUBLISHED",
      audienceType: "ALL",
      categoryIndex: 1, // Event
    },
    {
      title: "Monthly Newsletter - January",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Happy New Year! Here is our monthly newsletter with updates on school activities, student achievements, and upcoming events.",
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Highlights this month include our science fair winners, the art exhibition, and preparations for the spring festival.",
              },
            ],
          },
        ],
      },
      contentText:
        "Happy New Year! Here is our monthly newsletter with updates on school activities, student achievements, and upcoming events. Highlights this month include our science fair winners, the art exhibition, and preparations for the spring festival.",
      status: "PUBLISHED",
      audienceType: "ALL",
      categoryIndex: 2, // Newsletter
    },
    {
      title: "K1 Class Field Trip to the Zoo",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "K1 students will be going on a field trip to the zoo next Friday. Please ensure your child wears comfortable shoes and brings a packed lunch.",
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Permission slips must be returned by Wednesday. Contact us if you have any questions.",
              },
            ],
          },
        ],
      },
      contentText:
        "K1 students will be going on a field trip to the zoo next Friday. Please ensure your child wears comfortable shoes and brings a packed lunch. Permission slips must be returned by Wednesday. Contact us if you have any questions.",
      status: "PUBLISHED",
      audienceType: "CLASS",
      classIndex: 5, // K1 Class A (index 5 = grade 1, class 0)
      categoryIndex: 3, // Class Activity
    },
    {
      title: "Art Exhibition Next Week",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "We are proud to announce our annual art exhibition showcasing student artwork from all grades.",
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "The exhibition will be held in the school auditorium. All families are welcome to attend!",
              },
            ],
          },
        ],
      },
      contentText:
        "We are proud to announce our annual art exhibition showcasing student artwork from all grades. The exhibition will be held in the school auditorium. All families are welcome to attend!",
      status: "DRAFT",
      audienceType: "ALL",
      categoryIndex: 1, // Event
    },
    {
      title: "K2 Swimming Lessons Starting",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "K2 students will begin swimming lessons next month. Please ensure your child has appropriate swimwear and a towel.",
              },
            ],
          },
        ],
      },
      contentText:
        "K2 students will begin swimming lessons next month. Please ensure your child has appropriate swimwear and a towel.",
      status: "PENDING_APPROVAL",
      audienceType: "CLASS",
      classIndex: 10, // K2 Class A (index 10 = grade 2, class 0)
      categoryIndex: 3, // Class Activity
    },
  ];

  let postCount = 0;

  for (let i = 0; i < posts.length; i++) {
    const postData = posts[i];
    const postId = IDS.post(campusIndex, i);

    // Create the post
    await prisma.post.upsert({
      where: { id: postId },
      update: {},
      create: {
        id: postId,
        campusId: campusId,
        authorId: authorId,
        title: postData.title,
        content: postData.content,
        contentText: postData.contentText,
        status: postData.status,
        requiresApproval: postData.status !== "DRAFT",
        publishAt: postData.status === "PUBLISHED" ? new Date() : null,
      },
    });

    // Create audience
    const audienceId = IDS.postAudience(campusIndex, i, 0);
    if (postData.audienceType === "ALL") {
      await prisma.postAudience.upsert({
        where: { id: audienceId },
        update: {},
        create: {
          id: audienceId,
          postId: postId,
          campusId: campusId,
          type: "ALL",
        },
      });
    } else if (
      postData.audienceType === "CLASS" &&
      postData.classIndex !== undefined
    ) {
      const classId = classIds[postData.classIndex];
      if (classId) {
        await prisma.postAudience.upsert({
          where: { id: audienceId },
          update: {},
          create: {
            id: audienceId,
            postId: postId,
            campusId: campusId,
            type: "CLASS",
            classId: classId,
          },
        });
      }
    }

    // Link to category
    if (postData.categoryIndex !== undefined) {
      const categoryId = IDS.postCategory(campusIndex, postData.categoryIndex);
      await prisma.postCategoryLink.upsert({
        where: {
          postId_categoryId: {
            postId: postId,
            categoryId: categoryId,
          },
        },
        update: {},
        create: {
          postId: postId,
          categoryId: categoryId,
        },
      });
    }

    // Create initial history entry for published posts
    if (postData.status === "PUBLISHED") {
      await prisma.postHistoryStatus.upsert({
        where: {
          id: makeUUID(0xf3000000 + campusIndex * 0x1000, i),
        },
        update: {},
        create: {
          id: makeUUID(0xf3000000 + campusIndex * 0x1000, i),
          postId: postId,
          newStatus: "PUBLISHED",
          changedById: authorId,
          reason: "Initial publication",
        },
      });
    }

    postCount++;
  }

  return postCount;
}

async function seedStudentCodeSequences(campusId: string, campusIndex: number) {
  const totalStudents =
    CONFIG.GRADES_PER_CAMPUS *
    CONFIG.CLASSES_PER_GRADE *
    CONFIG.STUDENTS_PER_CLASS;

  await prisma.studentCodeSequence.upsert({
    where: {
      campusId_year: {
        campusId: campusId,
        year: 2024,
      },
    },
    update: { lastNumber: totalStudents },
    create: {
      campusId: campusId,
      year: 2024,
      lastNumber: totalStudents,
    },
  });

  await prisma.studentCodeSequence.upsert({
    where: {
      campusId_year: {
        campusId: campusId,
        year: 2025,
      },
    },
    update: {},
    create: {
      campusId: campusId,
      year: 2025,
      lastNumber: 0,
    },
  });
}

// ============================================================================
// Main Seed Function
// ============================================================================

async function main() {
  console.log("==========================================");
  console.log("Starting comprehensive database seed...");
  console.log("==========================================\n");

  console.log("Configuration:");
  console.log(`  - Campuses: ${CONFIG.CAMPUSES}`);
  console.log(`  - Grades per campus: ${CONFIG.GRADES_PER_CAMPUS}`);
  console.log(`  - Classes per grade: ${CONFIG.CLASSES_PER_GRADE}`);
  console.log(`  - Students per class: ${CONFIG.STUDENTS_PER_CLASS}`);
  console.log(`  - Guardians per student: ${CONFIG.GUARDIANS_PER_STUDENT}`);
  console.log(`  - Staff per campus: ${CONFIG.STAFF_PER_CAMPUS}`);
  console.log("");

  const totalStudentsPerCampus =
    CONFIG.GRADES_PER_CAMPUS *
    CONFIG.CLASSES_PER_GRADE *
    CONFIG.STUDENTS_PER_CLASS;
  const totalGuardiansPerCampus =
    totalStudentsPerCampus * CONFIG.GUARDIANS_PER_STUDENT;
  const totalClassesPerCampus =
    CONFIG.GRADES_PER_CAMPUS * CONFIG.CLASSES_PER_GRADE;

  console.log("Expected totals per campus:");
  console.log(`  - Classes: ${totalClassesPerCampus}`);
  console.log(`  - Students: ${totalStudentsPerCampus}`);
  console.log(`  - Guardians: ${totalGuardiansPerCampus}`);
  console.log(`  - Staff: ${CONFIG.STAFF_PER_CAMPUS}`);
  console.log("");

  // Seed global entities
  await seedGuardianRelationships();
  await seedPermissions();
  await seedSuperAdmin();

  // Seed campuses
  await seedCampuses();

  // Seed per-campus data
  for (let campusIndex = 0; campusIndex < CONFIG.CAMPUSES; campusIndex++) {
    const campusId = IDS.campus(campusIndex);
    console.log(`\n========================================`);
    console.log(
      `Seeding Campus ${campusIndex + 1}: ${CAMPUS_DATA[campusIndex].name}`,
    );
    console.log(`========================================`);

    // Seed roles and staff types
    console.log("Seeding roles...");
    const roles = await seedRolesForCampus(campusId, campusIndex);
    console.log(`  Created 3 roles`);

    console.log("Seeding staff types...");
    const staffTypes = await seedStaffTypesForCampus(
      campusId,
      campusIndex,
      roles,
    );
    console.log(`  Created 4 staff types`);

    // Create staff profile for super admin (only for first campus)
    if (campusIndex === 0) {
      await seedSuperAdminStaffProfile(campusId, staffTypes["Principal"]);
    }

    // Seed school years and subjects
    console.log("Seeding school years...");
    const currentSchoolYearId = await seedSchoolYearsForCampus(
      campusId,
      campusIndex,
    );
    console.log(`  Created 2 school years`);

    console.log("Seeding subjects...");
    const subjects = await seedSubjectsForCampus(campusId, campusIndex);
    console.log(`  Created 5 subjects`);

    // Seed grade levels
    console.log("Seeding grade levels...");
    const gradeLevelIds = await seedGradeLevelsForCampus(campusId, campusIndex);
    console.log(`  Created ${gradeLevelIds.length} grade levels`);

    // Seed classes, students, and guardians for each grade
    let totalStudents = 0;
    let totalGuardians = 0;
    let totalClasses = 0;
    const allClassIds: string[] = [];

    for (
      let gradeIndex = 0;
      gradeIndex < CONFIG.GRADES_PER_CAMPUS;
      gradeIndex++
    ) {
      const gradeLevelId = gradeLevelIds[gradeIndex];

      console.log(`Seeding ${GRADE_NAMES[gradeIndex]}...`);
      const classIds = await seedClassesForGrade(
        campusId,
        campusIndex,
        gradeLevelId,
        gradeIndex,
        currentSchoolYearId,
      );
      totalClasses += classIds.length;
      allClassIds.push(...classIds);

      for (let classIndex = 0; classIndex < classIds.length; classIndex++) {
        const classId = classIds[classIndex];
        const result = await seedStudentsAndGuardiansForClass(
          campusId,
          campusIndex,
          classId,
          classIndex,
          gradeIndex,
        );
        totalStudents += result.studentIds.length;
        totalGuardians += result.guardianIds.length;
      }

      console.log(
        `  Created ${classIds.length} classes with students and guardians`,
      );
    }

    // Seed staff
    console.log("Seeding staff...");
    const staffIds = await seedStaffForCampus(
      campusId,
      campusIndex,
      staffTypes,
      roles,
    );
    console.log(`  Created ${staffIds.length} staff members`);

    // Seed campus settings
    console.log("Seeding campus settings...");
    await seedCampusSettings(campusId, campusIndex);
    console.log(`  Created campus settings`);

    // Seed post categories
    console.log("Seeding post categories...");
    await seedPostCategoriesForCampus(campusId, campusIndex);
    console.log(`  Created 4 post categories`);

    // Seed posts (use first staff member as author)
    console.log("Seeding posts...");
    const firstStaffUserId = IDS.user("staff", campusIndex * 100);
    const postCount = await seedPostsForCampus(
      campusId,
      campusIndex,
      firstStaffUserId,
      allClassIds,
    );
    console.log(`  Created ${postCount} posts`);

    // Seed student code sequences
    console.log("Seeding student code sequences...");
    await seedStudentCodeSequences(campusId, campusIndex);
    console.log(`  Created student code sequences`);

    console.log(`\nCampus ${campusIndex + 1} Summary:`);
    console.log(`  - Classes: ${totalClasses}`);
    console.log(`  - Students: ${totalStudents}`);
    console.log(`  - Guardians: ${totalGuardians}`);
    console.log(`  - Posts: ${postCount}`);
    console.log(`  - Staff: ${staffIds.length}`);
  }

  console.log("\n==========================================");
  console.log("Database seed completed successfully!");
  console.log("==========================================");

  const grandTotalStudents =
    CONFIG.CAMPUSES *
    CONFIG.GRADES_PER_CAMPUS *
    CONFIG.CLASSES_PER_GRADE *
    CONFIG.STUDENTS_PER_CLASS;
  const grandTotalGuardians = grandTotalStudents * CONFIG.GUARDIANS_PER_STUDENT;
  const grandTotalClasses =
    CONFIG.CAMPUSES * CONFIG.GRADES_PER_CAMPUS * CONFIG.CLASSES_PER_GRADE;
  const grandTotalStaff = CONFIG.CAMPUSES * CONFIG.STAFF_PER_CAMPUS;

  console.log("\nGrand Totals:");
  console.log(`  - Campuses: ${CONFIG.CAMPUSES}`);
  console.log(`  - Classes: ${grandTotalClasses}`);
  console.log(`  - Students: ${grandTotalStudents}`);
  console.log(`  - Guardians: ${grandTotalGuardians}`);
  console.log(`  - Staff: ${grandTotalStaff}`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
