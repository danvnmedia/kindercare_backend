import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

import { PrismaService } from "../prisma.service";
import { PrismaStudentAttendanceRepository } from "./prisma-student-attendance.repository";

type StudentAttendanceSummaryDelegateMock = {
  findUnique: jest.Mock;
  findMany: jest.Mock;
};

const STUDENT_ID = "44444444-4444-4444-8444-444444444445";
const CLASS_ID = "44444444-4444-4444-8444-444444444444";

describe("PrismaStudentAttendanceRepository", () => {
  let repository: PrismaStudentAttendanceRepository;
  let attendanceDelegate: StudentAttendanceSummaryDelegateMock;

  beforeEach(() => {
    attendanceDelegate = {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    };

    repository = new PrismaStudentAttendanceRepository(
      {
        studentAttendanceSummary: attendanceDelegate,
      } as unknown as PrismaService,
      {} as PrismaQueryService,
    );
  });

  it("keeps a student-day lookup at UTC midnight", async () => {
    await repository.findByStudentAndDate(
      STUDENT_ID,
      new Date("2026-07-13T00:00:00.000Z"),
    );

    expect(attendanceDelegate.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId_date: {
            studentId: STUDENT_ID,
            date: new Date("2026-07-13T00:00:00.000Z"),
          },
        },
      }),
    );
  });

  it("keeps a class roll-call lookup at UTC midnight", async () => {
    await repository.findByClassAndDate(
      CLASS_ID,
      new Date("2026-07-13T00:00:00.000Z"),
    );

    expect(attendanceDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          classId: CLASS_ID,
          date: new Date("2026-07-13T00:00:00.000Z"),
        },
      }),
    );
  });

  it("keeps student attendance date ranges on UTC day boundaries", async () => {
    await repository.findByStudentDateRange(
      STUDENT_ID,
      new Date("2026-07-13T00:00:00.000Z"),
      new Date("2026-07-14T00:00:00.000Z"),
    );

    expect(attendanceDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId: STUDENT_ID,
          date: {
            gte: new Date("2026-07-13T00:00:00.000Z"),
            lte: new Date("2026-07-14T23:59:59.999Z"),
          },
        },
      }),
    );
  });
});
