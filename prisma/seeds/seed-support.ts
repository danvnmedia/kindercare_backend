import { PrismaClient } from "@prisma/client";
import { v5 as uuidv5 } from "uuid";

export const DEFAULT_SEED_CAMPUS_ID = "11111111-1111-4111-8111-111111111111";

const FIXTURE_NAMESPACE = "7b5835c8-96a0-4ae7-b48e-54f87b56f2d9";

export function getSeedCampusId(): string {
  return process.env.SEED_STUDENTS_CAMPUS_ID ?? DEFAULT_SEED_CAMPUS_ID;
}

export function fixtureId(
  campusId: string,
  entity: string,
  seedKey: string,
): string {
  return uuidv5(`${campusId}:${entity}:${seedKey}`, FIXTURE_NAMESPACE);
}

export function utcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export async function runSeedCli(
  seed: (prisma: PrismaClient) => Promise<unknown>,
): Promise<void> {
  const prisma = new PrismaClient();

  try {
    await seed(prisma);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
