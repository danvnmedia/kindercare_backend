import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import {
  StudentHealthCheckup,
  StudentHealthCheckupType,
  StudentHealthEvent,
  StudentHealthEventStatus,
  StudentHealthEventType,
  StudentHealthInstruction,
  StudentHealthInstructionType,
} from "@/domain/student-health";

import { PrismaService } from "../prisma.service";
import { PrismaStudentHealthCheckupRepository } from "./prisma-student-health-checkup.repository";
import { PrismaStudentHealthEventRepository } from "./prisma-student-health-event.repository";
import { PrismaStudentHealthInstructionRepository } from "./prisma-student-health-instruction.repository";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const STUDENT_ID = "22222222-2222-4222-a222-222222222222";
const ACTOR_ID = "33333333-3333-4333-a333-333333333333";
const ARCHIVED_AT = new Date("2026-07-14T15:00:00.000Z");

interface ConditionalRepositoryHarness {
  recordId: string;
  updateMany: jest.Mock;
  archive(): Promise<unknown>;
  update(): Promise<unknown>;
}

function createCheckupHarness(): ConditionalRepositoryHarness {
  const updateMany = jest.fn().mockResolvedValue({ count: 0 });
  const repository = new PrismaStudentHealthCheckupRepository(
    {
      studentHealthCheckup: { updateMany, findFirst: jest.fn() },
    } as unknown as PrismaService,
    {} as PrismaQueryService,
  );
  const record = StudentHealthCheckup.create(
    {
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
      checkupType: StudentHealthCheckupType.GENERAL,
      checkedAt: new Date("2020-01-15T09:00:00.000Z"),
      notes: "Routine checkup.",
    },
    "44444444-4444-4444-a444-444444444444",
  );

  return {
    recordId: record.id,
    updateMany,
    archive: () => {
      record.archive(ACTOR_ID, ARCHIVED_AT);
      return repository.archiveIfActive(record);
    },
    update: () => repository.updateIfActive(record),
  };
}

function createInstructionHarness(): ConditionalRepositoryHarness {
  const updateMany = jest.fn().mockResolvedValue({ count: 0 });
  const repository = new PrismaStudentHealthInstructionRepository(
    {
      studentHealthInstruction: { updateMany, findFirst: jest.fn() },
    } as unknown as PrismaService,
    {} as PrismaQueryService,
  );
  const record = StudentHealthInstruction.create(
    {
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
      instructionType: StudentHealthInstructionType.CARE,
      title: "Monitor hydration",
      instruction: "Offer water regularly.",
      startDate: "2026-07-01",
    },
    "55555555-5555-4555-a555-555555555555",
  );

  return {
    recordId: record.id,
    updateMany,
    archive: () => {
      record.archive(ACTOR_ID, ARCHIVED_AT);
      return repository.archiveIfActive(record);
    },
    update: () => repository.updateIfActive(record),
  };
}

function createEventHarness(): ConditionalRepositoryHarness {
  const updateMany = jest.fn().mockResolvedValue({ count: 0 });
  const repository = new PrismaStudentHealthEventRepository(
    {
      studentHealthEvent: { updateMany, findFirst: jest.fn() },
    } as unknown as PrismaService,
    {} as PrismaQueryService,
  );
  const record = StudentHealthEvent.create(
    {
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
      eventType: StudentHealthEventType.OBSERVATION,
      title: "Hydration observation",
      occurredAt: new Date("2020-01-15T09:00:00.000Z"),
      status: StudentHealthEventStatus.OPEN,
    },
    "66666666-6666-4666-a666-666666666666",
  );

  return {
    recordId: record.id,
    updateMany,
    archive: () => {
      record.archive(ACTOR_ID, ARCHIVED_AT);
      return repository.archiveIfActive(record);
    },
    update: () => repository.updateIfActive(record),
  };
}

describe.each([
  ["checkup", createCheckupHarness],
  ["instruction", createInstructionHarness],
  ["event", createEventHarness],
] as const)("Prisma student health %s conditional writes", (_name, create) => {
  it("archives only an active record owned by an active scoped student", async () => {
    const harness = create();

    await expect(harness.archive()).resolves.toBeNull();

    expect(harness.updateMany).toHaveBeenCalledWith({
      where: {
        id: harness.recordId,
        campusId: CAMPUS_ID,
        studentId: STUDENT_ID,
        archivedAt: null,
        student: { isArchived: false },
      },
      data: {
        archivedAt: ARCHIVED_AT,
        archivedByUserId: ACTOR_ID,
        updatedAt: ARCHIVED_AT,
      },
    });
  });

  it("updates only an active record in the immutable ownership scope", async () => {
    const harness = create();

    await expect(harness.update()).resolves.toBeNull();

    expect(harness.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: harness.recordId,
          campusId: CAMPUS_ID,
          studentId: STUDENT_ID,
          archivedAt: null,
          student: { isArchived: false },
        },
      }),
    );
  });
});
