import { NotFoundException } from "@nestjs/common";
import { GetStudentEnrollmentHistoryUseCase } from "./get-student-enrollment-history.use-case";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { Class } from "@/domain/class-management/entities/class.entity";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { Student } from "@/domain/user-management/entities/student.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";

describe("GetStudentEnrollmentHistoryUseCase", () => {
  let useCase: GetStudentEnrollmentHistoryUseCase;
  let enrollmentRepo: jest.Mocked<EnrollmentRepository>;
  let studentRepo: jest.Mocked<StudentRepository>;

  const campusId = "campus-1";
  const otherCampusId = "campus-2";
  const studentId = "student-1";

  const buildStudent = (overrides: { campusId?: string } = {}): Student =>
    Student.create(
      {
        campusId: overrides.campusId ?? campusId,
        studentCode: "STU001",
        fullName: "Nguyễn Văn A",
        email: null,
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
      },
      studentId,
    );

  const buildClassWithRelations = (
    classId: string,
    classOpts: {
      name: string;
      schoolYearName: string;
      gradeLevelName: string;
    },
  ): Class => {
    const schoolYear = SchoolYear.create(
      {
        campusId,
        name: classOpts.schoolYearName,
        startDate: new Date("2024-09-01T00:00:00.000Z"),
        endDate: new Date("2025-06-30T00:00:00.000Z"),
      },
      `sy-${classId}`,
    );
    const gradeLevel = GradeLevel.create(
      {
        campusId,
        name: classOpts.gradeLevelName,
        order: 1,
      },
      `gl-${classId}`,
    );
    return Class.create(
      {
        name: classOpts.name,
        campusId,
        gradeLevelId: gradeLevel.id,
        schoolYearId: schoolYear.id,
        description: null,
        gradeLevel,
        schoolYear,
      },
      classId,
    );
  };

  const buildEnrollment = (
    id: string,
    classId: string,
    enrollmentDate: Date,
    closed: { endDate: Date; exitReason: ExitReason } | null,
    classEntity?: Class,
  ): Enrollment =>
    Enrollment.create(
      {
        classId,
        studentId,
        enrollmentDate,
        endDate: closed?.endDate ?? null,
        exitReason: closed?.exitReason ?? null,
        note: null,
        class: classEntity,
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
    studentRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<StudentRepository>;
    useCase = new GetStudentEnrollmentHistoryUseCase(enrollmentRepo, studentRepo);
  });

  describe("AC-25: history with populated nested class metadata", () => {
    it("returns rows with class.name, class.schoolYear.name, class.gradeLevel.name, endDate, exitReason populated", async () => {
      studentRepo.findById.mockResolvedValue(buildStudent());

      const classA = buildClassWithRelations("class-a", {
        name: "Lớp A1",
        schoolYearName: "2024-2025",
        gradeLevelName: "Mầm",
      });
      const classB = buildClassWithRelations("class-b", {
        name: "Lớp B2",
        schoolYearName: "2024-2025",
        gradeLevelName: "Chồi",
      });

      // Repository returns rows ordered by enrollmentDate DESC.
      const history = [
        buildEnrollment(
          "e-2",
          "class-b",
          new Date("2025-02-01T00:00:00.000Z"),
          null,
          classB,
        ),
        buildEnrollment(
          "e-1",
          "class-a",
          new Date("2024-09-01T00:00:00.000Z"),
          {
            endDate: new Date("2025-01-31T00:00:00.000Z"),
            exitReason: ExitReason.TRANSFERRED,
          },
          classA,
        ),
      ];
      enrollmentRepo.findAllByStudentId.mockResolvedValue(history);

      const result = await useCase.execute({ studentId, campusId });

      expect(enrollmentRepo.findAllByStudentId).toHaveBeenCalledWith(studentId);
      expect(result).toHaveLength(2);

      // First (newest) — active in classB
      const newest = result[0];
      expect(newest.id).toBe("e-2");
      expect(newest.endDate).toBeNull();
      expect(newest.exitReason).toBeNull();
      expect(newest.class!.name).toBe("Lớp B2");
      expect(newest.class!.schoolYear!.name).toBe("2024-2025");
      expect(newest.class!.gradeLevel!.name).toBe("Chồi");

      // Second (older) — closed/transferred in classA
      const older = result[1];
      expect(older.id).toBe("e-1");
      expect(older.endDate).toEqual(new Date("2025-01-31T00:00:00.000Z"));
      expect(older.exitReason).toBe(ExitReason.TRANSFERRED);
      expect(older.class!.name).toBe("Lớp A1");
      expect(older.class!.schoolYear!.name).toBe("2024-2025");
      expect(older.class!.gradeLevel!.name).toBe("Mầm");
    });

    it("preserves the repository order (newest first) without re-sorting", async () => {
      studentRepo.findById.mockResolvedValue(buildStudent());
      const classA = buildClassWithRelations("class-a", {
        name: "Lớp A",
        schoolYearName: "2024-2025",
        gradeLevelName: "Mầm",
      });
      const ordered = [
        buildEnrollment(
          "e-3",
          "class-a",
          new Date("2026-01-01T00:00:00.000Z"),
          null,
          classA,
        ),
        buildEnrollment(
          "e-2",
          "class-a",
          new Date("2025-01-01T00:00:00.000Z"),
          {
            endDate: new Date("2025-12-31T00:00:00.000Z"),
            exitReason: ExitReason.WITHDRAWN,
          },
          classA,
        ),
        buildEnrollment(
          "e-1",
          "class-a",
          new Date("2024-01-01T00:00:00.000Z"),
          {
            endDate: new Date("2024-12-31T00:00:00.000Z"),
            exitReason: ExitReason.TRANSFERRED,
          },
          classA,
        ),
      ];
      enrollmentRepo.findAllByStudentId.mockResolvedValue(ordered);

      const result = await useCase.execute({ studentId, campusId });

      expect(result.map((e) => e.id)).toEqual(["e-3", "e-2", "e-1"]);
    });

    it("returns an empty array when student has no history", async () => {
      studentRepo.findById.mockResolvedValue(buildStudent());
      enrollmentRepo.findAllByStudentId.mockResolvedValue([]);

      const result = await useCase.execute({ studentId, campusId });

      expect(result).toEqual([]);
      expect(enrollmentRepo.findAllByStudentId).toHaveBeenCalledWith(studentId);
    });
  });

  describe("cross-campus rejection (AC-13 hide-existence pattern)", () => {
    it("throws NotFoundException when student belongs to a different campus", async () => {
      studentRepo.findById.mockResolvedValue(
        buildStudent({ campusId: otherCampusId }),
      );

      await expect(
        useCase.execute({ studentId, campusId }),
      ).rejects.toThrow(NotFoundException);

      expect(enrollmentRepo.findAllByStudentId).not.toHaveBeenCalled();
    });
  });

  describe("not-found", () => {
    it("throws NotFoundException when student does not exist", async () => {
      studentRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ studentId, campusId }),
      ).rejects.toThrow(NotFoundException);

      expect(enrollmentRepo.findAllByStudentId).not.toHaveBeenCalled();
    });
  });
});
