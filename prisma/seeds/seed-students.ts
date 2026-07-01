import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import * as path from "node:path";

const prisma = new PrismaClient();

const DEFAULT_CAMPUS_ID =
  process.env.SEED_STUDENTS_CAMPUS_ID ?? "11111111-1111-4111-8111-111111111111";
const CSV_PATH =
  process.env.SEED_STUDENTS_CSV ?? path.join(__dirname, "students.csv");
const CURRENT_YEAR = new Date().getFullYear();
const MAX_SEQUENCE_NUMBER = 999999;

type Gender = "MALE" | "FEMALE" | "OTHER";
type SeedStatus = "ACTIVE" | "DROPPED";

interface SeedStudent {
  fullName: string;
  nickname: string | null;
  status: SeedStatus;
  dateOfBirth: Date | null;
  gender: Gender | null;
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

function parseStatus(value: string, lineNumber: number): SeedStatus {
  const normalized = value.trim().toUpperCase();
  if (normalized === "ACTIVE" || normalized === "DROPPED") {
    return normalized;
  }

  throw new Error(`Invalid status "${value}" on line ${lineNumber}.`);
}

function readSeedStudents(): SeedStudent[] {
  const content = readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "");
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error(`No student rows found in ${CSV_PATH}.`);
  }

  const header = parseCsvLine(lines[0]).join(",");
  if (header !== "fullName,nickname,status,dateOfBirth,gender") {
    throw new Error(
      `Unexpected CSV header "${header}". Expected fullName,nickname,status,dateOfBirth,gender.`,
    );
  }

  return lines.slice(1).map((line, index) => {
    const lineNumber = index + 2;
    const fields = parseCsvLine(line);

    if (fields.length !== 5) {
      throw new Error(
        `Invalid CSV row on line ${lineNumber}. Expected 5 columns, got ${fields.length}.`,
      );
    }

    const [fullName, nickname, status, dateOfBirth, gender] = fields;
    const normalizedName = fullName.trim();

    if (normalizedName.length < 2) {
      throw new Error(`Invalid fullName on line ${lineNumber}.`);
    }

    return {
      fullName: normalizedName,
      nickname: normalizeOptional(nickname),
      status: parseStatus(status, lineNumber),
      dateOfBirth: parseDateOfBirth(dateOfBirth, lineNumber),
      gender: parseGender(gender, lineNumber),
    };
  });
}

function sequenceFromStudentCode(studentCode: string): number | null {
  const match = studentCode.match(/^(\d{4})-(\d{6})$/);
  if (!match || Number(match[1]) !== CURRENT_YEAR) return null;

  return Number(match[2]);
}

async function getHighestStudentSequence(campusId: string): Promise<number> {
  const students = await prisma.student.findMany({
    where: {
      campusId,
      studentCode: {
        startsWith: `${CURRENT_YEAR}-`,
      },
    },
    select: {
      studentCode: true,
    },
  });

  return students.reduce((highest, student) => {
    const sequence = sequenceFromStudentCode(student.studentCode);
    return sequence && sequence > highest ? sequence : highest;
  }, 0);
}

async function syncStudentCodeSequence(campusId: string): Promise<number> {
  const [highestStudentSequence, currentSequence] = await Promise.all([
    getHighestStudentSequence(campusId),
    prisma.studentCodeSequence.findUnique({
      where: {
        campusId_year: {
          campusId,
          year: CURRENT_YEAR,
        },
      },
    }),
  ]);
  const lastNumber = Math.max(
    highestStudentSequence,
    currentSequence?.lastNumber ?? 0,
  );

  await prisma.studentCodeSequence.upsert({
    where: {
      campusId_year: {
        campusId,
        year: CURRENT_YEAR,
      },
    },
    create: {
      campusId,
      year: CURRENT_YEAR,
      lastNumber,
    },
    update: {
      lastNumber,
    },
  });

  return lastNumber;
}

async function generateNextStudentCode(campusId: string): Promise<string> {
  const sequence = await prisma.studentCodeSequence.upsert({
    where: {
      campusId_year: {
        campusId,
        year: CURRENT_YEAR,
      },
    },
    create: {
      campusId,
      year: CURRENT_YEAR,
      lastNumber: 1,
    },
    update: {
      lastNumber: {
        increment: 1,
      },
    },
  });

  if (sequence.lastNumber > MAX_SEQUENCE_NUMBER) {
    throw new Error(
      `Student code sequence exhausted for campus ${campusId} in ${CURRENT_YEAR}.`,
    );
  }

  return `${CURRENT_YEAR}-${String(sequence.lastNumber).padStart(6, "0")}`;
}

async function main() {
  const campusId = DEFAULT_CAMPUS_ID;
  const campus = await prisma.campus.findUnique({
    where: { id: campusId },
    select: { id: true, name: true },
  });

  if (!campus) {
    throw new Error(
      `Campus ${campusId} not found. Run "npx prisma db seed" first or set SEED_STUDENTS_CAMPUS_ID.`,
    );
  }

  const students = readSeedStudents();
  console.log(`Seeding ${students.length} students into ${campus.name}...`);

  await syncStudentCodeSequence(campusId);

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const student of students) {
    const isArchived = student.status === "DROPPED";
    const existing = await prisma.student.findFirst({
      where: {
        campusId,
        fullName: student.fullName,
        dateOfBirth: student.dateOfBirth,
        nickname: student.nickname,
        gender: student.gender,
      },
    });

    if (existing) {
      const needsUpdate =
        existing.isArchived !== isArchived ||
        existing.fullName !== student.fullName ||
        existing.nickname !== student.nickname ||
        existing.gender !== student.gender ||
        Number(existing.dateOfBirth) !== Number(student.dateOfBirth);

      if (needsUpdate) {
        await prisma.student.update({
          where: { id: existing.id },
          data: {
            fullName: student.fullName,
            nickname: student.nickname,
            dateOfBirth: student.dateOfBirth,
            gender: student.gender,
            isArchived,
          },
        });
        updated++;
      } else {
        unchanged++;
      }

      continue;
    }

    const studentCode = await generateNextStudentCode(campusId);
    await prisma.student.create({
      data: {
        campusId,
        studentCode,
        fullName: student.fullName,
        nickname: student.nickname,
        dateOfBirth: student.dateOfBirth,
        gender: student.gender,
        isArchived,
      },
    });
    created++;
  }

  const sequence = await syncStudentCodeSequence(campusId);

  console.log("Student seed completed.");
  console.log(`  Campus: ${campus.name} (${campus.id})`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  ${CURRENT_YEAR} student sequence: ${sequence}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
