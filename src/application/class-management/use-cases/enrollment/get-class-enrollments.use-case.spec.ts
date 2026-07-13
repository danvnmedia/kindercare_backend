import { NotFoundException } from "@nestjs/common";

import { EnrollmentEffectiveStatusFilter } from "../../enrollment-effective-status-filter";
import { ClassRepository } from "../../ports/class.repository";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { HistoricalRecordRepository } from "../../ports/historical-record.repository";
import { Class } from "@/domain/class-management/entities/class.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";
import { EnrollmentEffectiveStatus } from "@/domain/class-management/enums/enrollment-effective-status.enum";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";

import { GetClassEnrollmentsUseCase } from "./get-class-enrollments.use-case";

describe("GetClassEnrollmentsUseCase", () => {
  const campusId = "campus-1";
  const classId = "class-1";
  const referenceDate = new Date("2026-07-11T23:59:59.999Z");
  let useCase: GetClassEnrollmentsUseCase;
  let enrollmentRepo: jest.Mocked<EnrollmentRepository>;
  let classRepo: jest.Mocked<ClassRepository>;
  let historicalRecordRepo: jest.Mocked<HistoricalRecordRepository>;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(referenceDate);
    enrollmentRepo = {
      findByClassIdAndEffectiveStatus: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<EnrollmentRepository>;
    classRepo = {
      findById: jest.fn().mockResolvedValue(buildClass()),
    } as unknown as jest.Mocked<ClassRepository>;
    historicalRecordRepo = {
      findCorrections: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<HistoricalRecordRepository>;
    useCase = new GetClassEnrollmentsUseCase(
      enrollmentRepo,
      classRepo,
      historicalRecordRepo,
    );
  });

  afterEach(() => jest.useRealTimers());

  it("defaults an omitted filter to ACTIVE at one UTC request boundary", async () => {
    const active = buildEnrollment(EnrollmentEffectiveStatus.ACTIVE);
    enrollmentRepo.findByClassIdAndEffectiveStatus.mockResolvedValue([active]);

    const result = await useCase.execute({ classId, campusId });

    expect(enrollmentRepo.findByClassIdAndEffectiveStatus).toHaveBeenCalledWith(
      classId,
      EnrollmentEffectiveStatusFilter.ACTIVE,
      referenceDate,
    );
    expect(result[0]).toMatchObject({
      id: active.id,
      effectiveStatus: EnrollmentEffectiveStatus.ACTIVE,
      cancelledAt: null,
      cancelledBy: null,
    });
    expect(historicalRecordRepo.findCorrections).toHaveBeenCalledWith(
      "ENROLLMENT",
      active.id,
    );
  });

  it.each(Object.values(EnrollmentEffectiveStatusFilter))(
    "forwards the %s status contract without compatibility branching",
    async (effectiveStatus) => {
      await useCase.execute({ classId, campusId, effectiveStatus });

      expect(
        enrollmentRepo.findByClassIdAndEffectiveStatus,
      ).toHaveBeenCalledWith(classId, effectiveStatus, referenceDate);
    },
  );

  it("returns authoritative cancellation facts for CANCELLED/ALL rows", async () => {
    const cancelled = buildEnrollment(EnrollmentEffectiveStatus.CANCELLED);
    enrollmentRepo.findByClassIdAndEffectiveStatus.mockResolvedValue([
      cancelled,
    ]);

    const result = await useCase.execute({
      classId,
      campusId,
      effectiveStatus: EnrollmentEffectiveStatusFilter.CANCELLED,
    });

    expect(result[0]).toMatchObject({
      effectiveStatus: EnrollmentEffectiveStatus.CANCELLED,
      cancellationReason: EnrollmentCancellationReason.FAMILY_REQUEST,
      cancellationNote: "plans changed",
      cancelledBy: { id: "actor-1", fullName: "Alice Admin" },
    });
  });

  it.each([null, buildClass("campus-2")])(
    "hides missing and cross-campus classes",
    async (classEntity) => {
      classRepo.findById.mockResolvedValue(classEntity);

      await expect(useCase.execute({ classId, campusId })).rejects.toThrow(
        NotFoundException,
      );
      expect(
        enrollmentRepo.findByClassIdAndEffectiveStatus,
      ).not.toHaveBeenCalled();
    },
  );

  function buildClass(classCampusId = campusId): Class {
    return Class.create(
      {
        name: "Class A",
        campusId: classCampusId,
        gradeLevelId: "grade-1",
        schoolYearId: "year-1",
      },
      classId,
    );
  }

  function buildEnrollment(status: EnrollmentEffectiveStatus): Enrollment {
    const base = Enrollment.create(
      {
        classId,
        studentId: `student-${status}`,
        schoolYearEnrollmentId: `parent-${status}`,
        enrollmentDate:
          status === EnrollmentEffectiveStatus.UPCOMING ||
          status === EnrollmentEffectiveStatus.CANCELLED
            ? new Date("2026-09-01T00:00:00.000Z")
            : new Date("2026-01-01T00:00:00.000Z"),
        endDate:
          status === EnrollmentEffectiveStatus.CLOSED
            ? new Date("2026-06-30T00:00:00.000Z")
            : null,
        exitReason:
          status === EnrollmentEffectiveStatus.CLOSED
            ? ExitReason.COMPLETED
            : null,
      },
      `enrollment-${status}`,
    );

    return status === EnrollmentEffectiveStatus.CANCELLED
      ? base.cancel({
          cancelledAt: referenceDate,
          reason: EnrollmentCancellationReason.FAMILY_REQUEST,
          note: "plans changed",
          actorId: "actor-1",
          actorFullName: "Alice Admin",
        })
      : base;
  }
});
