import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CAMPUS_ID =
  process.env.HEALTH_CENTER_SEED_CAMPUS_ID ??
  "11111111-1111-4111-8111-111111111111";

const STAFF_CODE_PATTERN = /^ST-(\d{4})-(\d{6})$/;
const MAX_STAFF_SEQUENCE_NUMBER = 999999;
const HEALTH_CENTER_STAFF_PHONE_NUMBER = "+84900000001";

const SEED_IDS = {
  authorUser: "44444444-4444-4444-8444-444444444440",
  authorStaff: "44444444-4444-4444-8444-444444444441",
  gradeLevel: "44444444-4444-4444-8444-444444444442",
  schoolYear: "44444444-4444-4444-8444-444444444443",
  class: "44444444-4444-4444-8444-444444444444",
  studentOne: "44444444-4444-4444-8444-444444444445",
  studentTwo: "44444444-4444-4444-8444-444444444446",
  schoolYearEnrollmentOne: "44444444-4444-4444-8444-444444444447",
  schoolYearEnrollmentTwo: "44444444-4444-4444-8444-444444444448",
  enrollmentOne: "44444444-4444-4444-8444-444444444449",
  enrollmentTwo: "44444444-4444-4444-8444-444444444450",
  medicationInstruction: "44444444-4444-4444-8444-444444444451",
  dietInstruction: "44444444-4444-4444-8444-444444444452",
  openIllnessEvent: "44444444-4444-4444-8444-444444444453",
  openObservationEvent: "44444444-4444-4444-8444-444444444454",
  resolvedEvent: "44444444-4444-4444-8444-444444444455",
  studentOneHealthProfile: "44444444-4444-4444-8444-444444444456",
  studentOneGeneralCheckup: "44444444-4444-4444-8444-444444444457",
  studentOneGrowthCheckup: "44444444-4444-4444-8444-444444444458",
} as const;

function utcDateOnly(dayOffset: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + dayOffset,
    ),
  );
}

function utcDateTime(dayOffset: number, hour: number, minute = 0): Date {
  const date = utcDateOnly(dayOffset);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

function safePastUtcDateTime(
  dayOffset: number,
  hour: number,
  minute = 0,
): Date {
  const requestedTime = utcDateTime(dayOffset, hour, minute);
  const latestAllowedTime = new Date(Date.now() - 5 * 60 * 1000);

  return requestedTime.getTime() <= latestAllowedTime.getTime()
    ? requestedTime
    : latestAllowedTime;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatStaffCode(year: number, sequence: number): string {
  return `ST-${year}-${String(sequence).padStart(6, "0")}`;
}

function sequenceFromStaffCode(staffCode: string, year: number): number | null {
  const match = staffCode.match(STAFF_CODE_PATTERN);
  if (!match || Number(match[1]) !== year) return null;

  return Number(match[2]);
}

async function getHighestStaffSequence(
  campusId: string,
  year: number,
): Promise<number> {
  const staffs = await prisma.staff.findMany({
    where: {
      campusId,
      staffCode: {
        startsWith: `ST-${year}-`,
      },
    },
    select: {
      staffCode: true,
    },
  });

  return staffs.reduce((highest, staff) => {
    const sequence = sequenceFromStaffCode(staff.staffCode, year);
    return sequence && sequence > highest ? sequence : highest;
  }, 0);
}

async function syncStaffCodeSequence(
  campusId: string,
  year: number,
): Promise<void> {
  const [highestStaffSequence, currentSequence] = await Promise.all([
    getHighestStaffSequence(campusId, year),
    prisma.staffCodeSequence.findUnique({
      where: {
        campusId_year: {
          campusId,
          year,
        },
      },
    }),
  ]);
  const lastNumber = Math.max(
    highestStaffSequence,
    currentSequence?.lastNumber ?? 0,
  );

  await prisma.staffCodeSequence.upsert({
    where: {
      campusId_year: {
        campusId,
        year,
      },
    },
    create: {
      campusId,
      year,
      lastNumber,
    },
    update: {
      lastNumber,
    },
  });
}

async function resolveSeedStaffCode(
  campusId: string,
  staffId: string,
  year: number,
): Promise<string> {
  const existing = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { staffCode: true },
  });

  if (existing && STAFF_CODE_PATTERN.test(existing.staffCode)) {
    return existing.staffCode;
  }

  const highestSequence = await getHighestStaffSequence(campusId, year);
  const nextSequence = highestSequence + 1;
  if (nextSequence > MAX_STAFF_SEQUENCE_NUMBER) {
    throw new Error(
      `Staff code sequence exhausted for campus ${campusId} in ${year}.`,
    );
  }

  return formatStaffCode(year, nextSequence);
}

async function upsertOpenSchoolYearEnrollment(params: {
  id: string;
  campusId: string;
  studentId: string;
  schoolYearId: string;
  gradeLevelId: string;
  enrollmentDate: Date;
}) {
  const existing = await prisma.schoolYearEnrollment.findFirst({
    where: {
      studentId: params.studentId,
      schoolYearId: params.schoolYearId,
      exitDate: null,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.schoolYearEnrollment.update({
      where: { id: existing.id },
      data: {
        campusId: params.campusId,
        gradeLevelId: params.gradeLevelId,
        enrollmentDate: params.enrollmentDate,
        exitDate: null,
        exitReason: null,
        note: "Health Center demo school-year enrollment",
      },
    });
  }

  return prisma.schoolYearEnrollment.create({
    data: {
      id: params.id,
      campusId: params.campusId,
      studentId: params.studentId,
      schoolYearId: params.schoolYearId,
      gradeLevelId: params.gradeLevelId,
      enrollmentDate: params.enrollmentDate,
      note: "Health Center demo school-year enrollment",
    },
  });
}

async function upsertOpenClassEnrollment(params: {
  id: string;
  studentId: string;
  classId: string;
  schoolYearEnrollmentId: string;
  enrollmentDate: Date;
}) {
  const existing = await prisma.enrollment.findFirst({
    where: {
      studentId: params.studentId,
      endDate: null,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.enrollment.update({
      where: { id: existing.id },
      data: {
        classId: params.classId,
        schoolYearEnrollmentId: params.schoolYearEnrollmentId,
        enrollmentDate: params.enrollmentDate,
        endDate: null,
        exitReason: null,
        note: "Health Center demo class enrollment",
      },
    });
  }

  return prisma.enrollment.create({
    data: {
      id: params.id,
      studentId: params.studentId,
      classId: params.classId,
      schoolYearEnrollmentId: params.schoolYearEnrollmentId,
      enrollmentDate: params.enrollmentDate,
      note: "Health Center demo class enrollment",
    },
  });
}

async function main() {
  const year = new Date().getUTCFullYear();
  const today = utcDateOnly(0);
  const yesterday = utcDateOnly(-1);
  const lastMonth = utcDateOnly(-30);
  const nextMonth = utcDateOnly(30);
  const schoolYearStart = new Date(Date.UTC(year, 0, 1));
  const schoolYearEnd = new Date(Date.UTC(year, 11, 31));

  console.log("Seeding Health Center demo data...");

  const campus = await prisma.campus.upsert({
    where: { id: CAMPUS_ID },
    update: { isArchived: false },
    create: {
      id: CAMPUS_ID,
      name: "Kindercare Health Center Demo",
      address: "Demo campus",
      isArchived: false,
    },
  });

  const authorUser = await prisma.user.upsert({
    where: { id: SEED_IDS.authorUser },
    update: {
      clerkUid: "seed-health-center-nurse",
      isActive: true,
    },
    create: {
      id: SEED_IDS.authorUser,
      clerkUid: "seed-health-center-nurse",
      isActive: true,
    },
  });

  const authorStaffCode = await resolveSeedStaffCode(
    campus.id,
    SEED_IDS.authorStaff,
    year,
  );

  await prisma.staff.upsert({
    where: { id: SEED_IDS.authorStaff },
    update: {
      campusId: campus.id,
      userId: authorUser.id,
      staffCode: authorStaffCode,
      fullName: "Health Center Nurse",
      email: "health-center-nurse.seed@example.test",
      phoneNumber: HEALTH_CENTER_STAFF_PHONE_NUMBER,
      isArchived: false,
    },
    create: {
      id: SEED_IDS.authorStaff,
      campusId: campus.id,
      userId: authorUser.id,
      staffCode: authorStaffCode,
      fullName: "Health Center Nurse",
      email: "health-center-nurse.seed@example.test",
      phoneNumber: HEALTH_CENTER_STAFF_PHONE_NUMBER,
      isArchived: false,
    },
  });
  await syncStaffCodeSequence(campus.id, year);

  const gradeLevel = await prisma.gradeLevel.upsert({
    where: {
      campusId_name: {
        campusId: campus.id,
        name: "Health Center Demo Grade",
      },
    },
    update: {
      order: 90,
      isArchived: false,
    },
    create: {
      id: SEED_IDS.gradeLevel,
      campusId: campus.id,
      name: "Health Center Demo Grade",
      order: 90,
      isArchived: false,
    },
  });

  const schoolYear = await prisma.schoolYear.upsert({
    where: {
      campusId_name: {
        campusId: campus.id,
        name: `Health Center Demo ${year}`,
      },
    },
    update: {
      startDate: schoolYearStart,
      endDate: schoolYearEnd,
      isArchived: false,
    },
    create: {
      id: SEED_IDS.schoolYear,
      campusId: campus.id,
      name: `Health Center Demo ${year}`,
      startDate: schoolYearStart,
      endDate: schoolYearEnd,
      isArchived: false,
    },
  });

  const demoClass = await prisma.class.upsert({
    where: {
      campusId_schoolYearId_gradeLevelId_name: {
        campusId: campus.id,
        schoolYearId: schoolYear.id,
        gradeLevelId: gradeLevel.id,
        name: "Health Center Demo Class",
      },
    },
    update: {
      description: "Lightweight class for Health Center aggregate API demos",
    },
    create: {
      id: SEED_IDS.class,
      campusId: campus.id,
      schoolYearId: schoolYear.id,
      gradeLevelId: gradeLevel.id,
      name: "Health Center Demo Class",
      description: "Lightweight class for Health Center aggregate API demos",
    },
  });

  const [studentOne, studentTwo] = await Promise.all([
    prisma.student.upsert({
      where: {
        campusId_studentCode: {
          campusId: campus.id,
          studentCode: "HC-SEED-001",
        },
      },
      update: {
        fullName: "An Nguyen",
        nickname: "An",
        gender: "FEMALE",
        isArchived: false,
      },
      create: {
        id: SEED_IDS.studentOne,
        campusId: campus.id,
        studentCode: "HC-SEED-001",
        fullName: "An Nguyen",
        nickname: "An",
        dateOfBirth: new Date(Date.UTC(year - 5, 4, 12)),
        gender: "FEMALE",
        isArchived: false,
      },
    }),
    prisma.student.upsert({
      where: {
        campusId_studentCode: {
          campusId: campus.id,
          studentCode: "HC-SEED-002",
        },
      },
      update: {
        fullName: "Binh Tran",
        nickname: "Binh",
        gender: "MALE",
        isArchived: false,
      },
      create: {
        id: SEED_IDS.studentTwo,
        campusId: campus.id,
        studentCode: "HC-SEED-002",
        fullName: "Binh Tran",
        nickname: "Binh",
        dateOfBirth: new Date(Date.UTC(year - 5, 8, 23)),
        gender: "MALE",
        isArchived: false,
      },
    }),
  ]);

  const [schoolYearEnrollmentOne, schoolYearEnrollmentTwo] = await Promise.all([
    upsertOpenSchoolYearEnrollment({
      id: SEED_IDS.schoolYearEnrollmentOne,
      campusId: campus.id,
      studentId: studentOne.id,
      schoolYearId: schoolYear.id,
      gradeLevelId: gradeLevel.id,
      enrollmentDate: lastMonth,
    }),
    upsertOpenSchoolYearEnrollment({
      id: SEED_IDS.schoolYearEnrollmentTwo,
      campusId: campus.id,
      studentId: studentTwo.id,
      schoolYearId: schoolYear.id,
      gradeLevelId: gradeLevel.id,
      enrollmentDate: lastMonth,
    }),
  ]);

  await Promise.all([
    upsertOpenClassEnrollment({
      id: SEED_IDS.enrollmentOne,
      studentId: studentOne.id,
      classId: demoClass.id,
      schoolYearEnrollmentId: schoolYearEnrollmentOne.id,
      enrollmentDate: lastMonth,
    }),
    upsertOpenClassEnrollment({
      id: SEED_IDS.enrollmentTwo,
      studentId: studentTwo.id,
      classId: demoClass.id,
      schoolYearEnrollmentId: schoolYearEnrollmentTwo.id,
      enrollmentDate: lastMonth,
    }),
  ]);

  await Promise.all([
    prisma.studentHealthProfile.upsert({
      where: { studentId: studentOne.id },
      update: {
        campusId: campus.id,
        allergies: [
          {
            name: "Peanuts",
            severity: "SEVERE",
            reaction: "Hives and facial swelling",
            notes: "Avoid peanut snacks and shared utensils.",
          },
          {
            name: "Dust mites",
            severity: "MILD",
            reaction: "Sneezing",
            notes: "Monitor during nap time.",
          },
        ],
        conditions: [
          {
            category: "RESPIRATORY",
            name: "Mild asthma",
            status: "MONITORING",
            notes: "Guardian supplied inhaler plan; call nurse for wheezing.",
          },
          {
            category: "OTHER",
            name: "Seasonal fever history",
            status: "ACTIVE",
            notes: "Check temperature if unusually tired after nap.",
          },
        ],
        restrictions: [
          {
            type: "FOOD",
            description: "No peanuts or peanut-based snacks",
            notes: "Use allergy-safe snack box when classroom snack is shared.",
          },
          {
            type: "ACTIVITY",
            description: "Limit outdoor running during heavy haze",
            notes: "Offer indoor quiet play when air quality is poor.",
          },
        ],
        emergencyNotes:
          "If breathing difficulty, swelling, or repeated vomiting occurs, call guardian and emergency contact immediately.",
        lastUpdatedByUserId: authorUser.id,
      },
      create: {
        id: SEED_IDS.studentOneHealthProfile,
        campusId: campus.id,
        studentId: studentOne.id,
        allergies: [
          {
            name: "Peanuts",
            severity: "SEVERE",
            reaction: "Hives and facial swelling",
            notes: "Avoid peanut snacks and shared utensils.",
          },
          {
            name: "Dust mites",
            severity: "MILD",
            reaction: "Sneezing",
            notes: "Monitor during nap time.",
          },
        ],
        conditions: [
          {
            category: "RESPIRATORY",
            name: "Mild asthma",
            status: "MONITORING",
            notes: "Guardian supplied inhaler plan; call nurse for wheezing.",
          },
          {
            category: "OTHER",
            name: "Seasonal fever history",
            status: "ACTIVE",
            notes: "Check temperature if unusually tired after nap.",
          },
        ],
        restrictions: [
          {
            type: "FOOD",
            description: "No peanuts or peanut-based snacks",
            notes: "Use allergy-safe snack box when classroom snack is shared.",
          },
          {
            type: "ACTIVITY",
            description: "Limit outdoor running during heavy haze",
            notes: "Offer indoor quiet play when air quality is poor.",
          },
        ],
        emergencyNotes:
          "If breathing difficulty, swelling, or repeated vomiting occurs, call guardian and emergency contact immediately.",
        lastUpdatedByUserId: authorUser.id,
      },
    }),
    prisma.studentHealthCheckup.upsert({
      where: { id: SEED_IDS.studentOneGeneralCheckup },
      update: {
        campusId: campus.id,
        studentId: studentOne.id,
        checkupType: "GENERAL",
        checkedAt: safePastUtcDateTime(0, 8, 30),
        heightCm: 109.5,
        weightKg: 18.4,
        notes:
          "Morning wellness check for Health Tab demo. Temperature 37.1C, active and hydrated.",
        recordedByUserId: authorUser.id,
        lastUpdatedByUserId: authorUser.id,
      },
      create: {
        id: SEED_IDS.studentOneGeneralCheckup,
        campusId: campus.id,
        studentId: studentOne.id,
        checkupType: "GENERAL",
        checkedAt: safePastUtcDateTime(0, 8, 30),
        heightCm: 109.5,
        weightKg: 18.4,
        notes:
          "Morning wellness check for Health Tab demo. Temperature 37.1C, active and hydrated.",
        recordedByUserId: authorUser.id,
        lastUpdatedByUserId: authorUser.id,
      },
    }),
    prisma.studentHealthCheckup.upsert({
      where: { id: SEED_IDS.studentOneGrowthCheckup },
      update: {
        campusId: campus.id,
        studentId: studentOne.id,
        checkupType: "GROWTH",
        checkedAt: utcDateTime(-21, 9, 0),
        heightCm: 108.8,
        weightKg: 18.1,
        notes: "Monthly growth record for Health Tab chart/history testing.",
        recordedByUserId: authorUser.id,
        lastUpdatedByUserId: authorUser.id,
      },
      create: {
        id: SEED_IDS.studentOneGrowthCheckup,
        campusId: campus.id,
        studentId: studentOne.id,
        checkupType: "GROWTH",
        checkedAt: utcDateTime(-21, 9, 0),
        heightCm: 108.8,
        weightKg: 18.1,
        notes: "Monthly growth record for Health Tab chart/history testing.",
        recordedByUserId: authorUser.id,
        lastUpdatedByUserId: authorUser.id,
      },
    }),
    prisma.studentHealthInstruction.upsert({
      where: { id: SEED_IDS.medicationInstruction },
      update: {
        campusId: campus.id,
        studentId: studentOne.id,
        instructionType: "MEDICATION",
        title: "Antibiotic after lunch",
        instruction: "Give medicine after lunch with water.",
        dosage: "5 ml",
        startDate: yesterday,
        endDate: nextMonth,
        timesOfDay: ["12:30"],
        scheduleNotes: "After lunch only.",
        notes: "Call guardian if vomiting occurs.",
        isActive: true,
        createdByUserId: authorUser.id,
        lastUpdatedByUserId: authorUser.id,
      },
      create: {
        id: SEED_IDS.medicationInstruction,
        campusId: campus.id,
        studentId: studentOne.id,
        instructionType: "MEDICATION",
        title: "Antibiotic after lunch",
        instruction: "Give medicine after lunch with water.",
        dosage: "5 ml",
        startDate: yesterday,
        endDate: nextMonth,
        timesOfDay: ["12:30"],
        scheduleNotes: "After lunch only.",
        notes: "Call guardian if vomiting occurs.",
        isActive: true,
        createdByUserId: authorUser.id,
        lastUpdatedByUserId: authorUser.id,
      },
    }),
    prisma.studentHealthInstruction.upsert({
      where: { id: SEED_IDS.dietInstruction },
      update: {
        campusId: campus.id,
        studentId: studentTwo.id,
        instructionType: "DIET",
        title: "No peanuts",
        instruction: "Avoid peanuts and peanut-based snacks.",
        dosage: null,
        startDate: lastMonth,
        endDate: null,
        timesOfDay: [],
        scheduleNotes: "Applies to all meals and snacks.",
        notes: "Use allergy-safe snack box if available.",
        isActive: true,
        createdByUserId: authorUser.id,
        lastUpdatedByUserId: authorUser.id,
      },
      create: {
        id: SEED_IDS.dietInstruction,
        campusId: campus.id,
        studentId: studentTwo.id,
        instructionType: "DIET",
        title: "No peanuts",
        instruction: "Avoid peanuts and peanut-based snacks.",
        startDate: lastMonth,
        timesOfDay: [],
        scheduleNotes: "Applies to all meals and snacks.",
        notes: "Use allergy-safe snack box if available.",
        isActive: true,
        createdByUserId: authorUser.id,
        lastUpdatedByUserId: authorUser.id,
      },
    }),
    prisma.studentHealthEvent.upsert({
      where: { id: SEED_IDS.openIllnessEvent },
      update: {
        campusId: campus.id,
        studentId: studentOne.id,
        eventType: "ILLNESS",
        category: "RESPIRATORY",
        title: "Low fever monitoring",
        description: "Temperature was slightly elevated after nap time.",
        occurredAt: utcDateTime(-1, 8, 45),
        status: "OPEN",
        resolutionNotes: null,
        recordedByUserId: authorUser.id,
        lastUpdatedByUserId: authorUser.id,
      },
      create: {
        id: SEED_IDS.openIllnessEvent,
        campusId: campus.id,
        studentId: studentOne.id,
        eventType: "ILLNESS",
        category: "RESPIRATORY",
        title: "Low fever monitoring",
        description: "Temperature was slightly elevated after nap time.",
        occurredAt: utcDateTime(-1, 8, 45),
        status: "OPEN",
        recordedByUserId: authorUser.id,
        lastUpdatedByUserId: authorUser.id,
      },
    }),
    prisma.studentHealthEvent.upsert({
      where: { id: SEED_IDS.openObservationEvent },
      update: {
        campusId: campus.id,
        studentId: studentTwo.id,
        eventType: "OBSERVATION",
        category: "SKIN",
        title: "Rash observation",
        description: "Small rash observed on left arm.",
        occurredAt: safePastUtcDateTime(0, 9, 15),
        status: "OPEN",
        resolutionNotes: null,
        recordedByUserId: authorUser.id,
        lastUpdatedByUserId: authorUser.id,
      },
      create: {
        id: SEED_IDS.openObservationEvent,
        campusId: campus.id,
        studentId: studentTwo.id,
        eventType: "OBSERVATION",
        category: "SKIN",
        title: "Rash observation",
        description: "Small rash observed on left arm.",
        occurredAt: safePastUtcDateTime(0, 9, 15),
        status: "OPEN",
        recordedByUserId: authorUser.id,
        lastUpdatedByUserId: authorUser.id,
      },
    }),
    prisma.studentHealthEvent.upsert({
      where: { id: SEED_IDS.resolvedEvent },
      update: {
        campusId: campus.id,
        studentId: studentOne.id,
        eventType: "INJURY",
        category: "OTHER",
        title: "Minor scratch resolved",
        description: "Small scratch cleaned and monitored.",
        occurredAt: utcDateTime(-2, 10, 0),
        status: "RESOLVED",
        resolutionNotes: "Resolved before pickup.",
        recordedByUserId: authorUser.id,
        lastUpdatedByUserId: authorUser.id,
      },
      create: {
        id: SEED_IDS.resolvedEvent,
        campusId: campus.id,
        studentId: studentOne.id,
        eventType: "INJURY",
        category: "OTHER",
        title: "Minor scratch resolved",
        description: "Small scratch cleaned and monitored.",
        occurredAt: utcDateTime(-2, 10, 0),
        status: "RESOLVED",
        resolutionNotes: "Resolved before pickup.",
        recordedByUserId: authorUser.id,
        lastUpdatedByUserId: authorUser.id,
      },
    }),
  ]);

  console.log("Health Center demo seed completed.");
  console.log(`  Campus: ${campus.name} (${campus.id})`);
  console.log(`  Class: ${demoClass.name} (${demoClass.id})`);
  console.log(
    `  Health Tab student: ${studentOne.fullName} (${studentOne.id})`,
  );
  console.log(`  Health Tab student code: ${studentOne.studentCode}`);
  console.log(`  Date: ${formatDateOnly(today)}`);
  console.log(`  Try: GET /api/students/${studentOne.id}/health-profile`);
  console.log(`  Try: GET /api/students/${studentOne.id}/health-checkups`);
  console.log(`  Try: GET /api/students/${studentOne.id}/health-events`);
  console.log(`  Try: GET /api/students/${studentOne.id}/health-instructions`);
  console.log(
    `  Try: GET /api/health-center/daily-items?date=${formatDateOnly(today)}`,
  );
  console.log(
    `  Try: GET /api/health-center/daily-items?date=${formatDateOnly(today)}&classId=${demoClass.id}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
