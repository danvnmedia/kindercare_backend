import { Prisma } from "@prisma/client";

import {
  PrismaStudentHealthCheckupMapper,
  PrismaStudentHealthCheckupWithRelations,
} from "./prisma-student-health-checkup.mapper";
import {
  PrismaStudentHealthEventMapper,
  PrismaStudentHealthEventWithRelations,
} from "./prisma-student-health-event.mapper";
import {
  PrismaStudentHealthInstructionMapper,
  PrismaStudentHealthInstructionWithRelations,
} from "./prisma-student-health-instruction.mapper";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const STUDENT_ID = "22222222-2222-4222-a222-222222222222";
const ARCHIVE_ACTOR_ID = "33333333-3333-4333-a333-333333333333";
const ARCHIVED_AT = new Date("2026-07-02T10:00:00.000Z");
const CREATED_AT = new Date("2020-01-15T09:05:00.000Z");

describe("student health archive mappers", () => {
  it("round-trips checkup archive metadata", () => {
    const row: PrismaStudentHealthCheckupWithRelations = {
      id: "44444444-4444-4444-a444-444444444444",
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
      checkupType: "GROWTH",
      checkedAt: new Date("2020-01-15T09:00:00.000Z"),
      heightCm: new Prisma.Decimal("108.5"),
      weightKg: new Prisma.Decimal("18.6"),
      notes: "Routine measurement.",
      recordedByUserId: null,
      lastUpdatedByUserId: null,
      archivedAt: ARCHIVED_AT,
      archivedByUserId: ARCHIVE_ACTOR_ID,
      createdAt: CREATED_AT,
      updatedAt: ARCHIVED_AT,
      recordedBy: null,
      lastUpdatedBy: null,
    };

    const entity = PrismaStudentHealthCheckupMapper.toDomain(row);

    expect(entity).toMatchObject({
      archivedAt: ARCHIVED_AT,
      archivedByUserId: ARCHIVE_ACTOR_ID,
      isArchived: true,
    });
    expect(
      PrismaStudentHealthCheckupMapper.toPrismaCreate(entity),
    ).toMatchObject({
      archivedAt: ARCHIVED_AT,
      archivedByUserId: ARCHIVE_ACTOR_ID,
    });
    expect(
      PrismaStudentHealthCheckupMapper.toPrismaUpdate(entity),
    ).toMatchObject({
      archivedAt: ARCHIVED_AT,
      archivedByUserId: ARCHIVE_ACTOR_ID,
    });
  });

  it("round-trips instruction archive metadata", () => {
    const row: PrismaStudentHealthInstructionWithRelations = {
      id: "55555555-5555-4555-a555-555555555555",
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
      instructionType: "CARE",
      title: "Monitor hydration",
      instruction: "Offer water regularly.",
      dosage: null,
      startDate: new Date("2026-07-01T00:00:00.000Z"),
      endDate: null,
      timesOfDay: [],
      scheduleNotes: null,
      notes: null,
      isActive: true,
      createdByUserId: null,
      lastUpdatedByUserId: null,
      archivedAt: ARCHIVED_AT,
      archivedByUserId: ARCHIVE_ACTOR_ID,
      createdAt: CREATED_AT,
      updatedAt: ARCHIVED_AT,
      createdBy: null,
      lastUpdatedBy: null,
    };

    const entity = PrismaStudentHealthInstructionMapper.toDomain(row);

    expect(entity.isArchived).toBe(true);
    expect(
      PrismaStudentHealthInstructionMapper.toPrismaCreate(entity),
    ).toMatchObject({
      archivedAt: ARCHIVED_AT,
      archivedByUserId: ARCHIVE_ACTOR_ID,
    });
    expect(
      PrismaStudentHealthInstructionMapper.toPrismaUpdate(entity),
    ).toMatchObject({
      archivedAt: ARCHIVED_AT,
      archivedByUserId: ARCHIVE_ACTOR_ID,
    });
  });

  it("round-trips event archive metadata without reviving ARCHIVED status", () => {
    const row: PrismaStudentHealthEventWithRelations = {
      id: "66666666-6666-4666-a666-666666666666",
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
      eventType: "ILLNESS",
      category: "EYE",
      title: "Eye redness observed",
      description: null,
      occurredAt: new Date("2020-01-15T09:00:00.000Z"),
      status: "RESOLVED",
      resolutionNotes: null,
      recordedByUserId: null,
      lastUpdatedByUserId: null,
      archivedAt: ARCHIVED_AT,
      archivedByUserId: ARCHIVE_ACTOR_ID,
      createdAt: CREATED_AT,
      updatedAt: ARCHIVED_AT,
      recordedBy: null,
      lastUpdatedBy: null,
    };

    const entity = PrismaStudentHealthEventMapper.toDomain(row);

    expect(entity).toMatchObject({
      status: "RESOLVED",
      archivedAt: ARCHIVED_AT,
      archivedByUserId: ARCHIVE_ACTOR_ID,
      isArchived: true,
    });
    expect(PrismaStudentHealthEventMapper.toPrismaCreate(entity)).toMatchObject(
      {
        status: "RESOLVED",
        archivedAt: ARCHIVED_AT,
        archivedByUserId: ARCHIVE_ACTOR_ID,
      },
    );
    expect(PrismaStudentHealthEventMapper.toPrismaUpdate(entity)).toMatchObject(
      {
        status: "RESOLVED",
        archivedAt: ARCHIVED_AT,
        archivedByUserId: ARCHIVE_ACTOR_ID,
      },
    );
  });
});
