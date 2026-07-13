import { PrismaClient } from "@prisma/client";
import { seedGuardians } from "./seed-guardians";
import { runSeedCli, utcToday } from "./seed-support";
import { seedStudents } from "./seed-students";

export async function seedDevData(prisma: PrismaClient) {
  const referenceDate = utcToday();
  const students = await seedStudents(prisma, { referenceDate });
  const guardians = await seedGuardians(prisma, {
    campusId: students.campusId,
  });

  return { students, guardians, referenceDate };
}

if (require.main === module) {
  void runSeedCli(seedDevData);
}
