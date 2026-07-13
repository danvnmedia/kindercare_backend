import {
  MedicationAdministrationOccurrence,
  MedicationAdministrationOutcome,
} from "@/domain/medication";

import { PrismaService } from "../prisma.service";
import { PrismaMedicationAdministrationRepository } from "./prisma-medication-administration.repository";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const STUDENT_ID = "22222222-2222-4222-a222-222222222222";
const CLASS_ID = "33333333-3333-4333-a333-333333333333";

describe("PrismaMedicationAdministrationRepository", () => {
  it("builds daily queue scope with selected-date class enrollment filtering and hydration", async () => {
    const occurrenceDelegate = {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    };
    const repository = new PrismaMedicationAdministrationRepository({
      medicationAdministrationOccurrence: occurrenceDelegate,
    } as unknown as PrismaService);
    const dueDate = new Date("2026-07-01T00:00:00.000Z");

    await repository.findDailyByCampus(CAMPUS_ID, {
      dueDate,
      classId: CLASS_ID,
      studentId: STUDENT_ID,
    });

    const findManyArg = occurrenceDelegate.findMany.mock.calls[0][0];

    expect(findManyArg.where).toEqual(
      expect.objectContaining({
        campusId: CAMPUS_ID,
        dueDate,
        studentId: STUDENT_ID,
        student: {
          enrollments: {
            some: {
              classId: CLASS_ID,
              class: { campusId: CAMPUS_ID },
              cancelledAt: null,
              enrollmentDate: { lte: dueDate },
              OR: [{ endDate: null }, { endDate: { gte: dueDate } }],
            },
          },
        },
      }),
    );
    expect(findManyArg.include.student.include.enrollments.where).toEqual({
      classId: CLASS_ID,
      class: { campusId: CAMPUS_ID },
      cancelledAt: null,
      enrollmentDate: { lte: dueDate },
      OR: [{ endDate: null }, { endDate: { gte: dueDate } }],
    });
    expect(findManyArg.orderBy).toEqual([{ dueMinute: "asc" }]);
  });

  it("counts current-day due and overdue unrecorded occurrences for Health Center summary", async () => {
    const occurrenceDelegate = {
      count: jest.fn().mockResolvedValueOnce(8).mockResolvedValueOnce(2),
    };
    const repository = new PrismaMedicationAdministrationRepository({
      medicationAdministrationOccurrence: occurrenceDelegate,
    } as unknown as PrismaService);
    const dueDate = new Date("2099-07-01T00:00:00.000Z");
    const now = new Date("2099-07-01T10:30:00.000Z");

    const result = await repository.countHealthCenterSummaryByCampus(
      CAMPUS_ID,
      {
        dueDate,
        now,
      },
    );

    expect(occurrenceDelegate.count).toHaveBeenNthCalledWith(1, {
      where: {
        campusId: CAMPUS_ID,
        dueDate,
        latestOutcome: null,
        dueMinute: { gte: 630 },
      },
    });
    expect(occurrenceDelegate.count).toHaveBeenNthCalledWith(2, {
      where: {
        campusId: CAMPUS_ID,
        dueDate,
        latestOutcome: null,
        dueMinute: { lt: 630 },
      },
    });
    expect(result).toEqual({ dueToday: 8, overdue: 2 });
  });

  it("matches daily queue absolute-time overdue boundary for partial minutes", async () => {
    const occurrenceDelegate = {
      count: jest.fn().mockResolvedValueOnce(8).mockResolvedValueOnce(3),
    };
    const repository = new PrismaMedicationAdministrationRepository({
      medicationAdministrationOccurrence: occurrenceDelegate,
    } as unknown as PrismaService);
    const dueDate = new Date("2099-07-01T00:00:00.000Z");

    await repository.countHealthCenterSummaryByCampus(CAMPUS_ID, {
      dueDate,
      now: new Date("2099-07-01T10:30:01.000Z"),
    });

    expect(occurrenceDelegate.count).toHaveBeenNthCalledWith(1, {
      where: {
        campusId: CAMPUS_ID,
        dueDate,
        latestOutcome: null,
        dueMinute: { gt: 630 },
      },
    });
    expect(occurrenceDelegate.count).toHaveBeenNthCalledWith(2, {
      where: {
        campusId: CAMPUS_ID,
        dueDate,
        latestOutcome: null,
        dueMinute: { lte: 630 },
      },
    });
  });

  it("counts all unrecorded past selected-date occurrences as overdue", async () => {
    const occurrenceDelegate = {
      count: jest.fn().mockResolvedValueOnce(5),
    };
    const repository = new PrismaMedicationAdministrationRepository({
      medicationAdministrationOccurrence: occurrenceDelegate,
    } as unknown as PrismaService);
    const dueDate = new Date("2099-07-01T00:00:00.000Z");

    const result = await repository.countHealthCenterSummaryByCampus(
      CAMPUS_ID,
      {
        dueDate,
        now: new Date("2099-07-02T12:00:00.000Z"),
      },
    );

    expect(occurrenceDelegate.count).toHaveBeenCalledTimes(1);
    expect(occurrenceDelegate.count).toHaveBeenCalledWith({
      where: {
        campusId: CAMPUS_ID,
        dueDate,
        latestOutcome: null,
      },
    });
    expect(result).toEqual({ dueToday: 0, overdue: 5 });
  });

  it("guards latest summary updates with the expected latest log id", async () => {
    const occurrenceDelegate = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    const repository = new PrismaMedicationAdministrationRepository({
      medicationAdministrationOccurrence: occurrenceDelegate,
    } as unknown as PrismaService);
    const occurrence = MedicationAdministrationOccurrence.create(
      {
        requestId: "44444444-4444-4444-a444-444444444444",
        medicationItemId: "55555555-5555-4555-a555-555555555555",
        campusId: CAMPUS_ID,
        studentId: STUDENT_ID,
        dueDate: "2026-07-01",
        dueMinute: 750,
        latestOutcome: MedicationAdministrationOutcome.GIVEN,
        latestLogId: "66666666-6666-4666-a666-666666666666",
        latestRecordedAt: new Date("2026-07-01T05:35:00.000Z"),
        latestRecordedByUserId: "77777777-7777-4777-a777-777777777777",
        latestNote: null,
      },
      "88888888-8888-4888-a888-888888888888",
    );

    await expect(
      repository.updateOccurrenceLatestIfExpected(
        occurrence,
        "99999999-9999-4999-a999-999999999999",
      ),
    ).resolves.toBeNull();

    expect(occurrenceDelegate.updateMany).toHaveBeenCalledWith({
      where: {
        id: occurrence.id,
        campusId: CAMPUS_ID,
        latestLogId: "99999999-9999-4999-a999-999999999999",
      },
      data: expect.objectContaining({
        latestOutcome: MedicationAdministrationOutcome.GIVEN,
        latestLogId: "66666666-6666-4666-a666-666666666666",
      }),
    });
    expect(occurrenceDelegate.findFirst).not.toHaveBeenCalled();
  });
});
