import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function sync() {
  const year = new Date().getFullYear();
  const prefix = `${year}-`;

  // Find all students with current year prefix
  const students = await prisma.student.findMany({
    where: { studentCode: { startsWith: prefix } },
    select: { studentCode: true },
  });

  let maxNumber = 0;
  for (const s of students) {
    const num = parseInt(s.studentCode.split("-")[1], 10);
    if (num > maxNumber) maxNumber = num;
  }

  if (maxNumber > 0) {
    await prisma.studentCodeSequence.upsert({
      where: { year },
      create: { year, lastNumber: maxNumber },
      update: { lastNumber: maxNumber },
    });
    console.log(`Synced sequence: year=${year}, lastNumber=${maxNumber}`);
  } else {
    console.log(`No students found for year ${year}`);
  }
}

sync().finally(() => prisma.$disconnect());
