import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

import { PrismaService } from "../prisma.service";
import { PrismaStudentHealthInstructionRepository } from "./prisma-student-health-instruction.repository";

describe("PrismaStudentHealthInstructionRepository effective class scope", () => {
  it("excludes future, closed, and cancelled class placements for the selected date", async () => {
    const delegate = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const repository = new PrismaStudentHealthInstructionRepository(
      { studentHealthInstruction: delegate } as unknown as PrismaService,
      {} as PrismaQueryService,
    );
    const selectedDate = new Date("2026-07-01T00:00:00.000Z");

    await repository.findActiveForHealthCenter({
      campusId: "campus-1",
      classId: "class-1",
      referenceDate: selectedDate,
      offset: 0,
      limit: 50,
    });

    const arg = delegate.findMany.mock.calls[0][0];
    const expectedEnrollment = {
      classId: "class-1",
      class: { campusId: "campus-1" },
      cancelledAt: null,
      enrollmentDate: { lte: selectedDate },
      OR: [{ endDate: null }, { endDate: { gte: selectedDate } }],
    };
    expect(arg.where.student.enrollments.some).toEqual(expectedEnrollment);
    expect(arg.include.student.select.enrollments.where).toEqual(
      expectedEnrollment,
    );
  });
});
