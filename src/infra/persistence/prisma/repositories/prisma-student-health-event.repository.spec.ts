import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { StudentHealthEventStatus } from "@/domain/student-health";

import { PrismaService } from "../prisma.service";
import { PrismaStudentHealthEventRepository } from "./prisma-student-health-event.repository";

type StudentHealthEventDelegateMock = {
  findMany: jest.Mock;
  count: jest.Mock;
};

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const NOW = new Date("2026-07-01T06:30:00.000Z");

describe("PrismaStudentHealthEventRepository", () => {
  let repository: PrismaStudentHealthEventRepository;
  let eventDelegate: StudentHealthEventDelegateMock;

  beforeEach(() => {
    eventDelegate = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };

    repository = new PrismaStudentHealthEventRepository(
      {
        studentHealthEvent: eventDelegate,
      } as unknown as PrismaService,
      {} as PrismaQueryService,
    );
  });

  it("caps Health Center open event reads at the request-provided cutoff", async () => {
    await repository.findOpenForHealthCenter({
      campusId: CAMPUS_ID,
      referenceDate: new Date("2026-07-01T00:00:00.000Z"),
      visibleUntil: NOW,
      offset: 0,
      limit: 50,
    });

    const findManyArg = eventDelegate.findMany.mock.calls[0][0];
    const countArg = eventDelegate.count.mock.calls[0][0];

    expect(findManyArg.where).toEqual(
      expect.objectContaining({
        campusId: CAMPUS_ID,
        archivedAt: null,
        status: StudentHealthEventStatus.OPEN,
        occurredAt: { lte: NOW },
      }),
    );
    expect(countArg.where.occurredAt).toEqual({ lte: NOW });
    expect(countArg.where.archivedAt).toBeNull();
  });

  it("uses selected day end for Health Center open event reads in the past", async () => {
    await repository.findOpenForHealthCenter({
      campusId: CAMPUS_ID,
      referenceDate: new Date("2026-06-30T00:00:00.000Z"),
      visibleUntil: NOW,
      offset: 0,
      limit: 50,
    });

    const findManyArg = eventDelegate.findMany.mock.calls[0][0];

    expect(findManyArg.where.occurredAt).toEqual({
      lte: new Date("2026-06-30T23:59:59.999Z"),
    });
  });

  it("filters class-scoped events by uncancelled enrollment effective on the selected date", async () => {
    const selectedDate = new Date("2026-07-01T00:00:00.000Z");

    await repository.findOpenForHealthCenter({
      campusId: CAMPUS_ID,
      classId: "class-1",
      referenceDate: selectedDate,
      visibleUntil: NOW,
      offset: 0,
      limit: 50,
    });

    const arg = eventDelegate.findMany.mock.calls[0][0];
    const expectedEnrollment = {
      classId: "class-1",
      class: { campusId: CAMPUS_ID },
      cancelledAt: null,
      enrollmentDate: { lte: selectedDate },
      OR: [{ endDate: null }, { endDate: { gte: selectedDate } }],
    };
    expect(arg.where.student.enrollments.some).toEqual(expectedEnrollment);
    expect(arg.include.student.select.enrollments.where).toEqual(
      expectedEnrollment,
    );
  });

  it("counts the same archived, campus, event, and enrollment scope without hydration", async () => {
    const selectedDate = new Date("2026-07-01T00:00:00.000Z");
    eventDelegate.count.mockResolvedValue(4);

    await expect(
      repository.countOpenForHealthCenter({
        campusId: CAMPUS_ID,
        classId: "class-1",
        referenceDate: selectedDate,
        visibleUntil: NOW,
      }),
    ).resolves.toBe(4);

    expect(eventDelegate.findMany).not.toHaveBeenCalled();
    expect(eventDelegate.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        campusId: CAMPUS_ID,
        archivedAt: null,
        status: StudentHealthEventStatus.OPEN,
        occurredAt: { lte: NOW },
        student: expect.objectContaining({
          campusId: CAMPUS_ID,
          enrollments: {
            some: expect.objectContaining({ classId: "class-1" }),
          },
        }),
      }),
    });
  });
});
