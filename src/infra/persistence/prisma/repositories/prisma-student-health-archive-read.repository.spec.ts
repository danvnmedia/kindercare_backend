import {
  StudentHealthEventStatus,
  StudentHealthEventType,
  StudentHealthInstructionStatus,
} from "@/domain/student-health";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

import { PrismaService } from "../prisma.service";
import { PrismaStudentHealthCheckupRepository } from "./prisma-student-health-checkup.repository";
import { PrismaStudentHealthEventRepository } from "./prisma-student-health-event.repository";
import { PrismaStudentHealthInstructionRepository } from "./prisma-student-health-instruction.repository";

const CAMPUS_ID = "campus-1";
const STUDENT_ID = "student-1";

describe("student health archive-aware reads", () => {
  const queryService = {
    executeQuery: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    buildWhereClause: jest
      .fn()
      .mockReturnValue({ title: { contains: "care" } }),
    buildOrderByClause: jest.fn().mockReturnValue({ createdAt: "desc" }),
    buildPaginationParams: jest.fn().mockReturnValue({ take: 10, skip: 20 }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps Health Snapshot list semantics and excludes archived checkups", async () => {
    const repository = new PrismaStudentHealthCheckupRepository(
      {} as PrismaService,
      queryService as unknown as PrismaQueryService,
    );
    const params = { limit: 1, offset: 0, sort: "-checkedAt" };

    await repository.findByStudentInCampus(CAMPUS_ID, STUDENT_ID, params);

    expect(queryService.executeQuery).toHaveBeenCalledWith(
      expect.anything(),
      "studentHealthCheckup",
      expect.objectContaining(params),
      expect.objectContaining({
        orderBy: { checkedAt: "desc" },
        scope: { campusId: CAMPUS_ID, studentId: STUDENT_ID, archivedAt: null },
      }),
      expect.anything(),
    );
  });

  it("allows archived checkups only when explicitly requested", async () => {
    const repository = new PrismaStudentHealthCheckupRepository(
      {} as PrismaService,
      queryService as unknown as PrismaQueryService,
    );

    await repository.findByStudentInCampus(CAMPUS_ID, STUDENT_ID, {
      includeArchived: true,
    });

    expect(queryService.executeQuery.mock.calls[0][3].scope).toEqual({
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
    });
  });

  it("defaults event history to active while preserving event filters", async () => {
    const repository = new PrismaStudentHealthEventRepository(
      {} as PrismaService,
      queryService as unknown as PrismaQueryService,
    );

    await repository.findByStudentInCampus(CAMPUS_ID, STUDENT_ID, {
      status: StudentHealthEventStatus.OPEN,
      eventType: StudentHealthEventType.ILLNESS,
      limit: 5,
      offset: 10,
      sort: "-occurredAt",
    });

    expect(queryService.executeQuery.mock.calls[0][3].scope).toEqual({
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
      archivedAt: null,
      status: "OPEN",
      eventType: "ILLNESS",
    });
  });

  it("allows archived events only when explicitly requested", async () => {
    const repository = new PrismaStudentHealthEventRepository(
      {} as PrismaService,
      queryService as unknown as PrismaQueryService,
    );

    await repository.findByStudentInCampus(CAMPUS_ID, STUDENT_ID, {
      includeArchived: true,
    });

    expect(queryService.executeQuery.mock.calls[0][3].scope).toEqual({
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
    });
  });

  it("defaults instruction history to active without changing pagination or filters", async () => {
    const delegate = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const repository = new PrismaStudentHealthInstructionRepository(
      { studentHealthInstruction: delegate } as unknown as PrismaService,
      queryService as unknown as PrismaQueryService,
    );

    await repository.findByStudentInCampus(CAMPUS_ID, STUDENT_ID, {
      status: StudentHealthInstructionStatus.ACTIVE,
      filter: "title|care",
      sort: "-createdAt",
      limit: 10,
      offset: 20,
    });

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { title: { contains: "care" } },
            expect.any(Object),
            {
              campusId: CAMPUS_ID,
              studentId: STUDENT_ID,
              archivedAt: null,
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        skip: 20,
      }),
    );
  });

  it("allows archived instructions only when explicitly requested", async () => {
    const delegate = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const repository = new PrismaStudentHealthInstructionRepository(
      { studentHealthInstruction: delegate } as unknown as PrismaService,
      queryService as unknown as PrismaQueryService,
    );

    await repository.findByStudentInCampus(CAMPUS_ID, STUDENT_ID, {
      includeArchived: true,
    });

    expect(delegate.findMany.mock.calls[0][0].where.AND[2]).toEqual({
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
    });
  });

  it("hard-codes archive exclusion for active student and class instruction queries", async () => {
    const delegate = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const repository = new PrismaStudentHealthInstructionRepository(
      { studentHealthInstruction: delegate } as unknown as PrismaService,
      queryService as unknown as PrismaQueryService,
    );
    const referenceDate = new Date("2026-07-01T00:00:00.000Z");

    await repository.findActiveByStudentInCampus(
      CAMPUS_ID,
      STUDENT_ID,
      referenceDate,
    );
    await repository.findActiveByStudentsInCampus(
      CAMPUS_ID,
      [STUDENT_ID],
      referenceDate,
    );

    expect(delegate.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ archivedAt: null }),
      }),
    );
    expect(delegate.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ archivedAt: null }),
      }),
    );
  });
});
