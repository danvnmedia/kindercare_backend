import { PrismaClient } from "@prisma/client";
import {
  GUARDIAN_FIXTURES,
  GUARDIAN_RELATIONSHIP_NAMES,
  GUARDIAN_STUDENT_LINKS,
} from "./seed-guardians";
import { seedDevData } from "./seed-dev-data";
import { fixtureId, getSeedCampusId, runSeedCli } from "./seed-support";
import { readSeedStudents, studentFixtureId } from "./seed-students";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Dev seed verification failed: ${message}`);
}

async function captureFixtureSnapshot(
  prisma: PrismaClient,
  campusId: string,
): Promise<string> {
  const studentIds = readSeedStudents().map(({ seedKey }) =>
    studentFixtureId(campusId, seedKey),
  );
  const guardianIds = GUARDIAN_FIXTURES.map(({ seedKey }) =>
    fixtureId(campusId, "guardian", seedKey),
  );
  const [students, guardians, links, relationships] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: studentIds } },
      orderBy: { id: "asc" },
      select: { id: true, studentCode: true, isArchived: true },
    }),
    prisma.guardian.findMany({
      where: { id: { in: guardianIds } },
      orderBy: { id: "asc" },
      select: { id: true, isArchived: true, userId: true },
    }),
    prisma.guardianStudent.findMany({
      where: { guardianId: { in: guardianIds } },
      orderBy: [{ studentId: "asc" }, { guardianId: "asc" }],
      select: {
        studentId: true,
        guardianId: true,
        guardianRelationshipId: true,
      },
    }),
    prisma.guardianRelationship.findMany({
      where: {
        campusId,
        name: { in: [...GUARDIAN_RELATIONSHIP_NAMES] },
      },
      orderBy: { order: "asc" },
      select: { id: true, name: true, order: true, isArchived: true },
    }),
  ]);

  return JSON.stringify({ students, guardians, links, relationships });
}

async function verifyFixtureState(
  prisma: PrismaClient,
  campusId: string,
): Promise<void> {
  const studentFixtures = readSeedStudents();
  const studentIds = studentFixtures.map(({ seedKey }) =>
    studentFixtureId(campusId, seedKey),
  );
  const guardianIds = GUARDIAN_FIXTURES.map(({ seedKey }) =>
    fixtureId(campusId, "guardian", seedKey),
  );
  const [phaseRows, guardians, relationshipRows, links] = await Promise.all([
    prisma.studentWithPhase.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, phase: true },
    }),
    prisma.guardian.findMany({
      where: { id: { in: guardianIds } },
      select: { id: true, campusId: true },
    }),
    prisma.guardianRelationship.findMany({
      where: {
        campusId,
        name: { in: [...GUARDIAN_RELATIONSHIP_NAMES] },
      },
      orderBy: { order: "asc" },
      select: { id: true, campusId: true, name: true, order: true },
    }),
    prisma.guardianStudent.findMany({
      where: { guardianId: { in: guardianIds } },
      include: {
        student: { select: { campusId: true } },
        guardian: { select: { campusId: true } },
        guardianRelationship: { select: { campusId: true } },
      },
    }),
  ]);

  assert(
    phaseRows.length === studentFixtures.length,
    `expected ${studentFixtures.length} students, found ${phaseRows.length}`,
  );
  const phaseById = new Map(phaseRows.map((row) => [row.id, row.phase]));
  for (const student of studentFixtures) {
    assert(
      phaseById.get(studentFixtureId(campusId, student.seedKey)) ===
        student.lifecycleScenario,
      `${student.seedKey} did not project ${student.lifecycleScenario}`,
    );
  }

  assert(
    guardians.length === GUARDIAN_FIXTURES.length,
    `expected ${GUARDIAN_FIXTURES.length} guardians, found ${guardians.length}`,
  );
  assert(
    guardians.every((guardian) => guardian.campusId === campusId),
    "guardian fixture escaped the selected campus",
  );
  assert(
    relationshipRows.map(({ name }) => name).join("|") ===
      GUARDIAN_RELATIONSHIP_NAMES.join("|"),
    "guardian relationship names or order differ from the fixture contract",
  );
  assert(
    relationshipRows.every(({ order }, index) => order === index + 1),
    "guardian relationship order is not contiguous from 1",
  );
  assert(
    links.length === GUARDIAN_STUDENT_LINKS.length,
    `expected ${GUARDIAN_STUDENT_LINKS.length} guardian links, found ${links.length}`,
  );
  assert(
    links.every(
      (link) =>
        link.student.campusId === campusId &&
        link.guardian.campusId === campusId &&
        link.guardianRelationship.campusId === campusId,
    ),
    "guardian link contains a cross-campus record",
  );

  const currentYear = new Date().getFullYear();
  const fixtureStudents = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { studentCode: true },
  });
  const highestFixtureCode = fixtureStudents.reduce((highest, student) => {
    const match = student.studentCode.match(/^(\d{4})-(\d{6})$/);
    return match && Number(match[1]) === currentYear
      ? Math.max(highest, Number(match[2]))
      : highest;
  }, 0);
  const sequence = await prisma.studentCodeSequence.findUnique({
    where: { campusId_year: { campusId, year: currentYear } },
  });
  assert(
    (sequence?.lastNumber ?? 0) >= highestFixtureCode,
    "student-code sequence is behind a fixture student code",
  );
}

export async function verifyDevData(prisma: PrismaClient): Promise<void> {
  if (process.env.SEED_VERIFY_ALLOW_MUTATION !== "true") {
    throw new Error(
      "Set SEED_VERIFY_ALLOW_MUTATION=true only for a disposable database before running seed verification.",
    );
  }

  const campusId = getSeedCampusId();
  await seedDevData(prisma);
  const firstSnapshot = await captureFixtureSnapshot(prisma, campusId);
  await seedDevData(prisma);
  const secondSnapshot = await captureFixtureSnapshot(prisma, campusId);

  assert(
    firstSnapshot === secondSnapshot,
    "second seed run changed fixture identity",
  );
  await verifyFixtureState(prisma, campusId);
  console.log("Optional development seed verification passed after two runs.");
}

if (require.main === module) {
  void runSeedCli(verifyDevData);
}
