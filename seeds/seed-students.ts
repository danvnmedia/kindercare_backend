import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface StudentCSVRow {
  fullName: string;
  nickname: string;
  status: string;
  dateOfBirth: string;
  gender: string;
}

/**
 * Parse date from d/m/yyyy or dd/mm/yyyy format to Date object
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === "") return null;

  const parts = dateStr.trim().split("/");
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

  return new Date(year, month, day);
}

/**
 * Generate student code in format YYYY-XXXXXX
 */
function generateStudentCode(index: number): string {
  const year = new Date().getFullYear();
  const paddedIndex = String(index).padStart(6, "0");
  return `${year}-${paddedIndex}`;
}

/**
 * Parse CSV content into array of StudentCSVRow
 */
function parseCSV(content: string): StudentCSVRow[] {
  const lines = content.trim().split("\n");
  const rows: StudentCSVRow[] = [];

  // Skip header row (first line)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(",");
    if (values.length < 5) continue;

    const fullName = values[0]?.trim();
    if (!fullName) continue;

    rows.push({
      fullName,
      nickname: values[1]?.trim() || "",
      status: values[2]?.trim() || "ACTIVE",
      dateOfBirth: values[3]?.trim() || "",
      gender: values[4]?.trim() || "",
    });
  }

  return rows;
}

async function main() {
  console.log("Starting student seeding from CSV...");

  // Read CSV file
  const csvPath = path.join(__dirname, "students.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const students = parseCSV(csvContent);

  console.log(`Found ${students.length} students in CSV file.`);

  // Get existing student codes to avoid conflicts
  const existingStudents = await prisma.student.findMany({
    select: { studentCode: true },
  });
  const existingCodes = new Set(existingStudents.map((s) => s.studentCode));

  // Find the next available index for student codes
  let codeIndex = 1;
  while (existingCodes.has(generateStudentCode(codeIndex))) {
    codeIndex++;
  }

  let created = 0;
  let skipped = 0;

  for (const student of students) {
    // Check if student with same fullName and dateOfBirth already exists
    const dateOfBirth = parseDate(student.dateOfBirth);
    const existingStudent = await prisma.student.findFirst({
      where: {
        fullName: student.fullName,
        dateOfBirth: dateOfBirth,
      },
    });

    if (existingStudent) {
      console.log(`  Skipping (exists): ${student.fullName}`);
      skipped++;
      continue;
    }

    // Generate unique student code
    let studentCode = generateStudentCode(codeIndex);
    while (existingCodes.has(studentCode)) {
      codeIndex++;
      studentCode = generateStudentCode(codeIndex);
    }

    // Create student
    await prisma.student.create({
      data: {
        studentCode,
        fullName: student.fullName,
        nickname: student.nickname || null,
        status: student.status || "ACTIVE",
        dateOfBirth,
        gender: student.gender || null,
      },
    });

    existingCodes.add(studentCode);
    codeIndex++;
    created++;

    console.log(`  Created: ${student.fullName} (${studentCode})`);
  }

  // Sync the student_code_sequence table so API continues from the right number
  const currentYear = new Date().getFullYear();
  const lastNumber = codeIndex - 1; // codeIndex was incremented after last use

  if (lastNumber > 0) {
    await prisma.studentCodeSequence.upsert({
      where: { year: currentYear },
      create: { year: currentYear, lastNumber },
      update: { lastNumber },
    });
    console.log(
      `\nSynced student_code_sequence: year=${currentYear}, lastNumber=${lastNumber}`,
    );
  }

  console.log("\n--- Summary ---");
  console.log(`Total in CSV: ${students.length}`);
  console.log(`Created: ${created}`);
  console.log(`Skipped (already exists): ${skipped}`);
  console.log("\nStudent seeding completed!");
}

main()
  .catch(async (e) => {
    console.error("Error seeding students:", e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
