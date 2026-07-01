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
  let nowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, "now").mockReturnValue(NOW.getTime());
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

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it("caps Health Center open event reads at now for the selected current day", async () => {
    await repository.findOpenForHealthCenter({
      campusId: CAMPUS_ID,
      referenceDate: new Date("2026-07-01T00:00:00.000Z"),
      offset: 0,
      limit: 50,
    });

    const findManyArg = eventDelegate.findMany.mock.calls[0][0];
    const countArg = eventDelegate.count.mock.calls[0][0];

    expect(findManyArg.where).toEqual(
      expect.objectContaining({
        campusId: CAMPUS_ID,
        status: StudentHealthEventStatus.OPEN,
        occurredAt: { lte: NOW },
      }),
    );
    expect(countArg.where.occurredAt).toEqual({ lte: NOW });
  });

  it("uses selected day end for Health Center open event reads in the past", async () => {
    await repository.findOpenForHealthCenter({
      campusId: CAMPUS_ID,
      referenceDate: new Date("2026-06-30T00:00:00.000Z"),
      offset: 0,
      limit: 50,
    });

    const findManyArg = eventDelegate.findMany.mock.calls[0][0];

    expect(findManyArg.where.occurredAt).toEqual({
      lte: new Date("2026-06-30T23:59:59.999Z"),
    });
  });
});
