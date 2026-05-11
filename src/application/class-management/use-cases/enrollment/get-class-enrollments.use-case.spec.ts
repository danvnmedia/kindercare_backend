import { NotFoundException } from "@nestjs/common";
import { GetClassEnrollmentsUseCase } from "./get-class-enrollments.use-case";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { ClassRepository } from "../../ports/class.repository";
import { Class } from "@/domain/class-management/entities/class.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";

describe("GetClassEnrollmentsUseCase", () => {
  let useCase: GetClassEnrollmentsUseCase;
  let enrollmentRepo: jest.Mocked<EnrollmentRepository>;
  let classRepo: jest.Mocked<ClassRepository>;

  const campusId = "campus-1";
  const otherCampusId = "campus-2";
  const classId = "class-1";

  const buildClass = (overrides: { campusId?: string } = {}): Class =>
    Class.create(
      {
        name: "Lớp A1",
        campusId: overrides.campusId ?? campusId,
        gradeLevelId: "grade-1",
        schoolYearId: "year-1",
        description: null,
      },
      classId,
    );

  const buildActive = (id: string, studentId: string): Enrollment =>
    Enrollment.create(
      {
        classId,
        studentId,
        enrollmentDate: new Date("2024-09-01T00:00:00.000Z"),
        endDate: null,
        exitReason: null,
        note: null,
      },
      id,
    );

  const buildClosed = (id: string, studentId: string): Enrollment =>
    Enrollment.create(
      {
        classId,
        studentId,
        enrollmentDate: new Date("2024-09-01T00:00:00.000Z"),
        endDate: new Date("2025-01-15T00:00:00.000Z"),
        exitReason: ExitReason.WITHDRAWN,
        note: null,
      },
      id,
    );

  beforeEach(() => {
    enrollmentRepo = {
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
      update: jest.fn(),
      transferEnrollment: jest.fn(),
      saveMany: jest.fn(),
    } as jest.Mocked<EnrollmentRepository>;
    classRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ClassRepository>;
    useCase = new GetClassEnrollmentsUseCase(enrollmentRepo, classRepo);
  });

  describe("AC-23: default returns only active rows", () => {
    it("calls findActiveByClassId when includeHistorical is omitted", async () => {
      classRepo.findById.mockResolvedValue(buildClass());
      const active = [buildActive("e1", "s1"), buildActive("e2", "s2")];
      enrollmentRepo.findActiveByClassId.mockResolvedValue(active);

      const result = await useCase.execute({ classId, campusId });

      expect(result).toEqual(active);
      expect(enrollmentRepo.findActiveByClassId).toHaveBeenCalledWith(classId);
      expect(enrollmentRepo.findHistoricalByClassId).not.toHaveBeenCalled();
    });

    it("calls findActiveByClassId when includeHistorical=false explicit", async () => {
      classRepo.findById.mockResolvedValue(buildClass());
      enrollmentRepo.findActiveByClassId.mockResolvedValue([]);

      await useCase.execute({ classId, campusId, includeHistorical: false });

      expect(enrollmentRepo.findActiveByClassId).toHaveBeenCalledWith(classId);
      expect(enrollmentRepo.findHistoricalByClassId).not.toHaveBeenCalled();
    });
  });

  describe("AC-24: includeHistorical=true returns all rows", () => {
    it("calls findHistoricalByClassId when includeHistorical=true", async () => {
      classRepo.findById.mockResolvedValue(buildClass());
      const all = [
        buildActive("e3", "s3"),
        buildClosed("e2", "s2"),
        buildClosed("e1", "s1"),
      ];
      enrollmentRepo.findHistoricalByClassId.mockResolvedValue(all);

      const result = await useCase.execute({
        classId,
        campusId,
        includeHistorical: true,
      });

      expect(result).toEqual(all);
      expect(enrollmentRepo.findHistoricalByClassId).toHaveBeenCalledWith(
        classId,
      );
      expect(enrollmentRepo.findActiveByClassId).not.toHaveBeenCalled();
    });
  });

  describe("cross-campus rejection (AC-13 hide-existence pattern)", () => {
    it("throws NotFoundException when class belongs to a different campus", async () => {
      classRepo.findById.mockResolvedValue(
        buildClass({ campusId: otherCampusId }),
      );

      await expect(
        useCase.execute({ classId, campusId }),
      ).rejects.toThrow(NotFoundException);

      expect(enrollmentRepo.findActiveByClassId).not.toHaveBeenCalled();
      expect(enrollmentRepo.findHistoricalByClassId).not.toHaveBeenCalled();
    });
  });

  describe("not-found", () => {
    it("throws NotFoundException when class does not exist", async () => {
      classRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ classId, campusId }),
      ).rejects.toThrow(NotFoundException);

      expect(enrollmentRepo.findActiveByClassId).not.toHaveBeenCalled();
      expect(enrollmentRepo.findHistoricalByClassId).not.toHaveBeenCalled();
    });
  });
});
