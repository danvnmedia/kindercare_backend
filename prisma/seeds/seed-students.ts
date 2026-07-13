import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import {
  addUtcDays,
  fixtureId,
  getSeedCampusId,
  runSeedCli,
  utcToday,
} from "./seed-support";

const CSV_PATH =
  process.env.SEED_STUDENTS_CSV ?? path.join(__dirname, "students.csv");
const CURRENT_YEAR = new Date().getFullYear();
const MAX_SEQUENCE_NUMBER = 999999;
const EXPECTED_HEADER =
  "seedKey,fullName,nickname,lifecycleScenario,isArchived,dateOfBirth,gender";

export const STUDENT_LIFECYCLE_SCENARIOS = [
  "ACTIVE",
  "WAITING",
  "DEFERRED",
  "COMPLETED",
  "GRADUATED",
  "WITHDRAWN",
] as const;

export type StudentLifecycleScenario =
  (typeof STUDENT_LIFECYCLE_SCENARIOS)[number];
type Gender = "MALE" | "FEMALE" | "OTHER";

export interface SeedStudent {
  seedKey: string;
  fullName: string;
  nickname: string | null;
  lifecycleScenario: StudentLifecycleScenario;
  isArchived: boolean;
  dateOfBirth: Date | null;
  gender: Gender | null;
}

export interface SeedStudentsOptions {
  campusId?: string;
  csvPath?: string;
  referenceDate?: Date;
}

export interface SeedStudentsResult {
  campusId: string;
  campusName: string;
  created: number;
  updated: number;
  students: SeedStudent[];
  studentIds: Map<string, string>;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (inQuotes) {
    throw new Error(`Unterminated quoted CSV field in line: ${line}`);
  }

  fields.push(current);
  return fields.map((field) => field.trim());
}

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseDateOfBirth(value: string, lineNumber: number): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    throw new Error(
      `Invalid dateOfBirth "${trimmed}" on line ${lineNumber}. Expected d/m/yyyy.`,
    );
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(
      `Invalid calendar date "${trimmed}" on line ${lineNumber}.`,
    );
  }

  return date;
}

function parseGender(value: string, lineNumber: number): Gender | null {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  if (
    normalized === "MALE" ||
    normalized === "FEMALE" ||
    normalized === "OTHER"
  ) {
    return normalized;
  }

  throw new Error(`Invalid gender "${value}" on line ${lineNumber}.`);
}

function parseLifecycleScenario(
  value: string,
  lineNumber: number,
): StudentLifecycleScenario {
  const normalized = value.trim().toUpperCase();
  if (
    STUDENT_LIFECYCLE_SCENARIOS.includes(normalized as StudentLifecycleScenario)
  ) {
    return normalized as StudentLifecycleScenario;
  }

  throw new Error(
    `Invalid lifecycleScenario "${value}" on line ${lineNumber}.`,
  );
}

function parseBoolean(value: string, lineNumber: number): boolean {
  const normalized = value.trim().toUpperCase();
  if (normalized === "TRUE") return true;
  if (normalized === "FALSE") return false;
  throw new Error(
    `Invalid isArchived "${value}" on line ${lineNumber}. Expected TRUE or FALSE.`,
  );
}

export function parseSeedStudents(
  content: string,
  source = "student fixture CSV",
): SeedStudent[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error(`No student rows found in ${source}.`);
  }

  const header = parseCsvLine(lines[0]).join(",");
  if (header !== EXPECTED_HEADER) {
    throw new Error(
      `Unexpected CSV header "${header}". Expected ${EXPECTED_HEADER}.`,
    );
  }

  const seedKeys = new Set<string>();
  const naturalKeys = new Set<string>();

  return lines.slice(1).map((line, index) => {
    const lineNumber = index + 2;
    const fields = parseCsvLine(line);

    if (fields.length !== 7) {
      throw new Error(
        `Invalid CSV row on line ${lineNumber}. Expected 7 columns, got ${fields.length}.`,
      );
    }

    const [
      seedKey,
      fullName,
      nickname,
      lifecycleScenario,
      isArchived,
      dateOfBirth,
      gender,
    ] = fields;
    const normalizedSeedKey = seedKey.trim().toLowerCase();
    const normalizedName = fullName.trim();

    if (!/^[a-z0-9-]+$/.test(normalizedSeedKey)) {
      throw new Error(`Invalid seedKey "${seedKey}" on line ${lineNumber}.`);
    }
    if (seedKeys.has(normalizedSeedKey)) {
      throw new Error(
        `Duplicate seedKey "${normalizedSeedKey}" on line ${lineNumber}.`,
      );
    }
    if (normalizedName.length < 2) {
      throw new Error(`Invalid fullName on line ${lineNumber}.`);
    }

    const parsedDateOfBirth = parseDateOfBirth(dateOfBirth, lineNumber);
    const parsedNickname = normalizeOptional(nickname);
    const parsedGender = parseGender(gender, lineNumber);
    const naturalKey = [
      normalizedName.toLocaleLowerCase("vi"),
      parsedNickname?.toLocaleLowerCase("vi") ?? "",
      parsedDateOfBirth?.toISOString().slice(0, 10) ?? "",
      parsedGender ?? "",
    ].join("|");

    if (naturalKeys.has(naturalKey)) {
      throw new Error(
        `Duplicate student fixture identity on line ${lineNumber}.`,
      );
    }

    seedKeys.add(normalizedSeedKey);
    naturalKeys.add(naturalKey);

    return {
      seedKey: normalizedSeedKey,
      fullName: normalizedName,
      nickname: parsedNickname,
      lifecycleScenario: parseLifecycleScenario(lifecycleScenario, lineNumber),
      isArchived: parseBoolean(isArchived, lineNumber),
      dateOfBirth: parsedDateOfBirth,
      gender: parsedGender,
    };
  });
}

export function readSeedStudents(csvPath = CSV_PATH): SeedStudent[] {
  return parseSeedStudents(readFileSync(csvPath, "utf8"), csvPath);
}

export function studentFixtureId(campusId: string, seedKey: string): string {
  return fixtureId(campusId, "student", seedKey);
}

function sequenceFromStudentCode(studentCode: string): number | null {
  const match = studentCode.match(/^(\d{4})-(\d{6})$/);
  if (!match || Number(match[1]) !== CURRENT_YEAR) return null;
  return Number(match[2]);
}

async function getHighestStudentSequence(
  prisma: PrismaClient,
  campusId: string,
): Promise<number> {
  const students = await prisma.student.findMany({
    where: {
      campusId,
      studentCode: { startsWith: `${CURRENT_YEAR}-` },
    },
    select: { studentCode: true },
  });

  return students.reduce((highest, student) => {
    const sequence = sequenceFromStudentCode(student.studentCode);
    return sequence && sequence > highest ? sequence : highest;
  }, 0);
}

async function syncStudentCodeSequence(
  prisma: PrismaClient,
  campusId: string,
): Promise<number> {
  const [highestStudentSequence, currentSequence] = await Promise.all([
    getHighestStudentSequence(prisma, campusId),
    prisma.studentCodeSequence.findUnique({
      where: { campusId_year: { campusId, year: CURRENT_YEAR } },
    }),
  ]);
  const lastNumber = Math.max(
    highestStudentSequence,
    currentSequence?.lastNumber ?? 0,
  );

  await prisma.studentCodeSequence.upsert({
    where: { campusId_year: { campusId, year: CURRENT_YEAR } },
    create: { campusId, year: CURRENT_YEAR, lastNumber },
    update: { lastNumber },
  });

  return lastNumber;
}

async function generateNextStudentCode(
  prisma: PrismaClient,
  campusId: string,
): Promise<string> {
  const sequence = await prisma.studentCodeSequence.upsert({
    where: { campusId_year: { campusId, year: CURRENT_YEAR } },
    create: { campusId, year: CURRENT_YEAR, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });

  if (sequence.lastNumber > MAX_SEQUENCE_NUMBER) {
    throw new Error(
      `Student code sequence exhausted for campus ${campusId} in ${CURRENT_YEAR}.`,
    );
  }

  return `${CURRENT_YEAR}-${String(sequence.lastNumber).padStart(6, "0")}`;
}

async function seedAcademicFixtures(
  prisma: PrismaClient,
  campusId: string,
  referenceDate: Date,
) {
  const gradeLevel = await prisma.gradeLevel.upsert({
    where: {
      campusId_name: { campusId, name: "Dev Seed Grade" },
    },
    create: {
      id: fixtureId(campusId, "grade-level", "dev-seed-grade"),
      campusId,
      name: "Dev Seed Grade",
      order: 900,
      isArchived: false,
    },
    update: { isArchived: false },
  });

  const schoolYear = await prisma.schoolYear.upsert({
    where: {
      campusId_name: { campusId, name: "Dev Seed Lifecycle Year" },
    },
    create: {
      id: fixtureId(campusId, "school-year", "dev-seed-lifecycle-year"),
      campusId,
      name: "Dev Seed Lifecycle Year",
      startDate: addUtcDays(referenceDate, -400),
      endDate: addUtcDays(referenceDate, 400),
      isArchived: false,
    },
    update: {
      startDate: addUtcDays(referenceDate, -400),
      endDate: addUtcDays(referenceDate, 400),
      isArchived: false,
    },
  });

  const classFixture = await prisma.class.upsert({
    where: {
      campusId_schoolYearId_gradeLevelId_name: {
        campusId,
        schoolYearId: schoolYear.id,
        gradeLevelId: gradeLevel.id,
        name: "Dev Seed Class",
      },
    },
    create: {
      id: fixtureId(campusId, "class", "dev-seed-class"),
      campusId,
      schoolYearId: schoolYear.id,
      gradeLevelId: gradeLevel.id,
      name: "Dev Seed Class",
      description: "Optional development seed class",
    },
    update: { description: "Optional development seed class" },
  });

  return { gradeLevel, schoolYear, classFixture };
}

async function seedLifecycleScenario(
  prisma: PrismaClient,
  campusId: string,
  student: SeedStudent,
  studentId: string,
  referenceDate: Date,
  academic: Awaited<ReturnType<typeof seedAcademicFixtures>>,
): Promise<void> {
  const schoolYearEnrollmentId = fixtureId(
    campusId,
    "school-year-enrollment",
    student.seedKey,
  );
  const enrollmentId = fixtureId(campusId, "enrollment", student.seedKey);

  if (student.lifecycleScenario === "WAITING") {
    await prisma.enrollment.deleteMany({ where: { id: enrollmentId } });
    await prisma.schoolYearEnrollment.deleteMany({
      where: { id: schoolYearEnrollmentId },
    });
    return;
  }

  const isDeferred = student.lifecycleScenario === "DEFERRED";
  const isClosed =
    student.lifecycleScenario === "COMPLETED" ||
    student.lifecycleScenario === "GRADUATED" ||
    student.lifecycleScenario === "WITHDRAWN";
  const enrollmentDate = isDeferred
    ? addUtcDays(referenceDate, 30)
    : isClosed
      ? addUtcDays(referenceDate, -300)
      : addUtcDays(referenceDate, -90);
  const exitDate = isClosed ? addUtcDays(referenceDate, -30) : null;
  const exitReason = isClosed ? student.lifecycleScenario : null;

  await prisma.schoolYearEnrollment.upsert({
    where: { id: schoolYearEnrollmentId },
    create: {
      id: schoolYearEnrollmentId,
      studentId,
      campusId,
      schoolYearId: academic.schoolYear.id,
      gradeLevelId: academic.gradeLevel.id,
      enrollmentDate,
      exitDate,
      exitReason,
    },
    update: {
      studentId,
      campusId,
      schoolYearId: academic.schoolYear.id,
      gradeLevelId: academic.gradeLevel.id,
      enrollmentDate,
      exitDate,
      exitReason,
      cancelledAt: null,
      cancellationReason: null,
      cancellationNote: null,
      cancelledByUserId: null,
      cancelledByFullName: null,
    },
  });

  if (isDeferred) {
    await prisma.enrollment.deleteMany({ where: { id: enrollmentId } });
    return;
  }

  await prisma.enrollment.upsert({
    where: { id: enrollmentId },
    create: {
      id: enrollmentId,
      classId: academic.classFixture.id,
      studentId,
      schoolYearEnrollmentId,
      enrollmentDate,
      endDate: exitDate,
      exitReason,
    },
    update: {
      classId: academic.classFixture.id,
      studentId,
      schoolYearEnrollmentId,
      enrollmentDate,
      endDate: exitDate,
      exitReason,
      cancelledAt: null,
      cancellationReason: null,
      cancellationNote: null,
      cancelledByUserId: null,
      cancelledByFullName: null,
    },
  });
}

export async function seedStudents(
  prisma: PrismaClient,
  options: SeedStudentsOptions = {},
): Promise<SeedStudentsResult> {
  const campusId = options.campusId ?? getSeedCampusId();
  const referenceDate = options.referenceDate ?? utcToday();
  const campus = await prisma.campus.findUnique({
    where: { id: campusId },
    select: { id: true, name: true },
  });

  if (!campus) {
    throw new Error(
      `Campus ${campusId} not found. Run "npx prisma db seed" first or set SEED_STUDENTS_CAMPUS_ID.`,
    );
  }

  const students = readSeedStudents(options.csvPath ?? CSV_PATH);
  const academic = await seedAcademicFixtures(prisma, campusId, referenceDate);
  await syncStudentCodeSequence(prisma, campusId);

  let created = 0;
  let updated = 0;
  const studentIds = new Map<string, string>();

  for (const student of students) {
    const id = studentFixtureId(campusId, student.seedKey);
    const existing = await prisma.student.findUnique({ where: { id } });
    const profileData = {
      campusId,
      fullName: student.fullName,
      nickname: student.nickname,
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      isArchived: student.isArchived,
    };

    if (existing) {
      await prisma.student.update({ where: { id }, data: profileData });
      updated++;
    } else {
      await prisma.student.create({
        data: {
          id,
          studentCode: await generateNextStudentCode(prisma, campusId),
          ...profileData,
        },
      });
      created++;
    }

    studentIds.set(student.seedKey, id);
    await seedLifecycleScenario(
      prisma,
      campusId,
      student,
      id,
      referenceDate,
      academic,
    );
  }

  const sequence = await syncStudentCodeSequence(prisma, campusId);
  console.log(
    `Student seed completed for ${campus.name}: ${created} created, ${updated} updated, sequence ${sequence}.`,
  );

  return {
    campusId,
    campusName: campus.name,
    created,
    updated,
    students,
    studentIds,
  };
}

if (require.main === module) {
  void runSeedCli((prisma) => seedStudents(prisma));
}
