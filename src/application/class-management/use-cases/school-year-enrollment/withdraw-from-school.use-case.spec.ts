import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { WithdrawFromSchoolUseCase } from "./withdraw-from-school.use-case";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { SchoolYearEnrollmentErrorCode } from "../../school-year-enrollment-error-codes";

describe("WithdrawFromSchoolUseCase", () => {
  let useCase: WithdrawFromSchoolUseCase;
  let mockSyeRepository: jest.Mocked<SchoolYearEnrollmentRepository>;
  let mockEnrollmentRepository: jest.Mocked<EnrollmentRepository>;

  const campusId = "campus-1";
  const differentCampusId = "campus-2";
  const studentId = "student-1";
  const schoolYearId = "school-year-1";
  const gradeLevelId = "grade-level-1";
  const classId = "class-1";
  const parentId = "sye-1";
  const childId = "enr-1";
  const enrollmentDate = new Date("2025-09-01T00:00:00.000Z");

  const createMockParent = (
    overrides: {
      campusId?: string;
      exitDate?: Date | null;
      exitReason?: ExitReason | null;
      note?: string | null;
    } = {},
  ): SchoolYearEnrollment =>
    SchoolYearEnrollment.create(
      {
        studentId,
        campusId: overrides.campusId ?? campusId,
        schoolYearId,
        gradeLevelId,
        enrollmentDate,
        exitDate: overrides.exitDate ?? null,
        exitReason: overrides.exitReason ?? null,
        note: overrides.note ?? null,
      },
      parentId,
    );

  const createMockChild = (
    overrides: { enrollmentDate?: Date } = {},
  ): Enrollment =>
    Enrollment.create(
      {
        classId,
        studentId,
        schoolYearEnrollmentId: parentId,
        enrollmentDate: overrides.enrollmentDate ?? enrollmentDate,
        endDate: null,
        exitReason: null,
        note: null,
      },
      childId,
    );

  beforeEach(() => {
    mockSyeRepository = {
      findById: jest.fn(),
      findOpenByStudentAndSchoolYear: jest.fn(),
      findAllByStudentId: jest.fn(),
      findAllByStudentIdWithChildCount: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      withdrawWithChildren: jest.fn(),
    } as jest.Mocked<SchoolYearEnrollmentRepository>;

    mockEnrollmentRepository = {
      findById: jest.fn(),
      findByStudentClassDate: jest.fn(),
      findByClassId: jest.fn(),
      findByStudentId: jest.fn(),
      findActiveByStudentId: jest.fn(),
      findActiveByClassId: jest.fn(),
      findHistoricalByClassId: jest.fn(),
      findAllByStudentId: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      saveMany: jest.fn(),
      update: jest.fn(),
      transferEnrollment: jest.fn(),
    } as jest.Mocked<EnrollmentRepository>;

    useCase = new WithdrawFromSchoolUseCase(
      mockSyeRepository,
      mockEnrollmentRepository,
    );
  });

  // Convenience: parent open + active child + transparent withdrawWithChildren.
  const arrangeWithChild = (childOverrides?: { enrollmentDate?: Date }) => {
    mockSyeRepository.findById.mockResolvedValue(createMockParent());
    mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(
      createMockChild(childOverrides),
    );
    mockSyeRepository.withdrawWithChildren.mockImplementation(
      async (closedParent, closedChild) => ({
        closedParent,
        closedChild,
      }),
    );
  };

  // Convenience: parent open + no active child.
  const arrangeWithoutChild = () => {
    mockSyeRepository.findById.mockResolvedValue(createMockParent());
    mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(null);
    mockSyeRepository.withdrawWithChildren.mockImplementation(
      async (closedParent, closedChild) => ({
        closedParent,
        closedChild,
      }),
    );
  };

  it("happy path WITHDRAWN — closes parent and open child atomically (Scenario 4)", async () => {
    arrangeWithChild();
    const exitDate = new Date("2026-03-15T00:00:00.000Z");
    const expectedDateOnly = new Date(Date.UTC(2026, 2, 15));

    const result = await useCase.execute({
      id: parentId,
      campusId,
      reason: ExitReason.WITHDRAWN,
      exitDate,
    });

    expect(result.closedParent.id).toBe(parentId);
    expect(result.closedParent.exitDate).toEqual(expectedDateOnly);
    expect(result.closedParent.exitReason).toBe(ExitReason.WITHDRAWN);

    expect(result.closedChild).not.toBeNull();
    expect(result.closedChild!.id).toBe(childId);
    expect(result.closedChild!.endDate).toEqual(expectedDateOnly);
    expect(result.closedChild!.exitReason).toBe(ExitReason.WITHDRAWN);

    expect(mockSyeRepository.withdrawWithChildren).toHaveBeenCalledTimes(1);
    const [parentArg, childArg] =
      mockSyeRepository.withdrawWithChildren.mock.calls[0];
    expect(parentArg.id).toBe(parentId);
    expect(childArg?.id).toBe(childId);
    expect(mockEnrollmentRepository.findActiveByStudentId).toHaveBeenCalledWith(
      studentId,
    );
  });

  it("happy path WITHDRAWN — no open child, closes parent only (Scenario 5)", async () => {
    arrangeWithoutChild();

    const result = await useCase.execute({
      id: parentId,
      campusId,
      reason: ExitReason.WITHDRAWN,
      exitDate: new Date("2026-03-15T00:00:00.000Z"),
    });

    expect(result.closedParent.id).toBe(parentId);
    expect(result.closedChild).toBeNull();
    expect(mockSyeRepository.withdrawWithChildren).toHaveBeenCalledWith(
      expect.any(SchoolYearEnrollment),
      null,
    );
  });

  it("happy path GRADUATED — child closes with GRADUATED reason", async () => {
    arrangeWithChild();

    const result = await useCase.execute({
      id: parentId,
      campusId,
      reason: ExitReason.GRADUATED,
      exitDate: new Date("2026-03-15T00:00:00.000Z"),
    });

    expect(result.closedParent.exitReason).toBe(ExitReason.GRADUATED);
    expect(result.closedChild!.exitReason).toBe(ExitReason.GRADUATED);
  });

  it("happy path COMPLETED — child closes with COMPLETED reason", async () => {
    arrangeWithChild();

    const result = await useCase.execute({
      id: parentId,
      campusId,
      reason: ExitReason.COMPLETED,
      exitDate: new Date("2026-03-15T00:00:00.000Z"),
    });

    expect(result.closedParent.exitReason).toBe(ExitReason.COMPLETED);
    expect(result.closedChild!.exitReason).toBe(ExitReason.COMPLETED);
  });

  it("throws 404 when parent is missing", async () => {
    mockSyeRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        id: parentId,
        campusId,
        reason: ExitReason.WITHDRAWN,
      }),
    ).rejects.toThrow(NotFoundException);

    expect(
      mockEnrollmentRepository.findActiveByStudentId,
    ).not.toHaveBeenCalled();
    expect(mockSyeRepository.withdrawWithChildren).not.toHaveBeenCalled();
  });

  it("throws 404 when parent belongs to a different campus (cross-campus hidden)", async () => {
    mockSyeRepository.findById.mockResolvedValue(
      createMockParent({ campusId: differentCampusId }),
    );

    await expect(
      useCase.execute({
        id: parentId,
        campusId,
        reason: ExitReason.WITHDRAWN,
      }),
    ).rejects.toThrow(NotFoundException);

    expect(
      mockEnrollmentRepository.findActiveByStudentId,
    ).not.toHaveBeenCalled();
    expect(mockSyeRepository.withdrawWithChildren).not.toHaveBeenCalled();
  });

  it("throws 409 PARENT_ALREADY_CLOSED when parent already closed (Scenario 10)", async () => {
    mockSyeRepository.findById.mockResolvedValue(
      createMockParent({
        exitDate: new Date("2026-02-01T00:00:00.000Z"),
        exitReason: ExitReason.WITHDRAWN,
      }),
    );

    await expect(
      useCase.execute({
        id: parentId,
        campusId,
        reason: ExitReason.WITHDRAWN,
      }),
    ).rejects.toThrow(
      new ConflictException(
        SchoolYearEnrollmentErrorCode.PARENT_ALREADY_CLOSED,
      ),
    );

    expect(
      mockEnrollmentRepository.findActiveByStudentId,
    ).not.toHaveBeenCalled();
    expect(mockSyeRepository.withdrawWithChildren).not.toHaveBeenCalled();
  });

  it("throws 400 INVALID_EXIT_DATE when exitDate is before parent.enrollmentDate (Scenario 11)", async () => {
    arrangeWithoutChild();

    await expect(
      useCase.execute({
        id: parentId,
        campusId,
        reason: ExitReason.WITHDRAWN,
        // parent enrollmentDate = 2025-09-01; exitDate intentionally earlier
        exitDate: new Date("2025-08-30T00:00:00.000Z"),
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockSyeRepository.withdrawWithChildren).not.toHaveBeenCalled();
  });

  it("throws 400 INVALID_EXIT_DATE when exitDate is in the future (Scenario 11)", async () => {
    arrangeWithoutChild();

    await expect(
      useCase.execute({
        id: parentId,
        campusId,
        reason: ExitReason.WITHDRAWN,
        exitDate: new Date("2099-01-01T00:00:00.000Z"),
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockSyeRepository.withdrawWithChildren).not.toHaveBeenCalled();
  });

  it("defaults exitDate to today when omitted", async () => {
    arrangeWithoutChild();
    const today = new Date();
    const todayDateOnly = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    const result = await useCase.execute({
      id: parentId,
      campusId,
      reason: ExitReason.WITHDRAWN,
    });

    expect(result.closedParent.exitDate).toEqual(todayDateOnly);
  });

  it("persists the optional note onto the closed parent", async () => {
    arrangeWithoutChild();

    const result = await useCase.execute({
      id: parentId,
      campusId,
      reason: ExitReason.WITHDRAWN,
      exitDate: new Date("2026-03-15T00:00:00.000Z"),
      note: "Family relocated overseas",
    });

    expect(result.closedParent.note).toBe("Family relocated overseas");
  });
});
