import { NotFoundException } from "@nestjs/common";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";
import {
  SchoolYearEnrollmentRepository,
  SchoolYearStudentListItem,
} from "../../ports/school-year-enrollment.repository";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import { HistoricalRecordRepository } from "../../ports/historical-record.repository";
import { GetSchoolYearStudentsUseCase } from "./get-school-year-students.use-case";

describe("GetSchoolYearStudentsUseCase", () => {
  let useCase: GetSchoolYearStudentsUseCase;
  let syeRepository: jest.Mocked<SchoolYearEnrollmentRepository>;
  let schoolYearRepository: jest.Mocked<SchoolYearRepository>;
  let historicalRecordRepository: jest.Mocked<HistoricalRecordRepository>;

  const campusId = "11111111-1111-4111-8111-111111111111";
  const schoolYearId = "22222222-2222-4222-8222-222222222222";
  const referenceDate = new Date("2026-07-11T12:00:00.000Z");

  const schoolYear = () =>
    SchoolYear.create(
      {
        campusId,
        name: "2026-2027",
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2027-06-30T00:00:00.000Z"),
      },
      schoolYearId,
    );

  const parentEnrollment = (
    enrollmentDate = new Date("2026-09-01T00:00:00.000Z"),
  ) =>
    SchoolYearEnrollment.create(
      {
        studentId: "33333333-3333-4333-8333-333333333333",
        campusId,
        schoolYearId,
        gradeLevelId: "44444444-4444-4444-8444-444444444444",
        enrollmentDate,
        snapshotStudentFullName: "Snapshot Student",
        snapshotStudentCode: "STU-001",
        snapshotStudentNickname: "Snapshot",
        snapshotGradeLevelName: "Mầm",
        snapshotGradeLevelOrder: 1,
        snapshotSchoolYearName: "2026-2027",
        snapshotSchoolYearStartDate: new Date("2026-09-01T00:00:00.000Z"),
        snapshotSchoolYearEndDate: new Date("2027-06-30T00:00:00.000Z"),
      },
      "55555555-5555-4555-8555-555555555555",
    );

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(referenceDate);
    syeRepository = {
      findById: jest.fn(),
      findOpenByStudentAndSchoolYear: jest.fn(),
      findLatestByStudentAndSchoolYear: jest.fn(),
      findAllByStudentId: jest.fn(),
      findAllByStudentIdWithChildCount: jest.fn(),
      findStudentsBySchoolYear: jest.fn(),
      countChildEnrollments: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      correctGradeLevel: jest.fn(),
      withdrawWithChildren: jest.fn(),
    } as unknown as jest.Mocked<SchoolYearEnrollmentRepository>;
    schoolYearRepository = {
      findById: jest.fn(),
      findByNameAndCampus: jest.fn(),
      findNonArchived: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      archive: jest.fn(),
      unarchive: jest.fn(),
    } as unknown as jest.Mocked<SchoolYearRepository>;
    historicalRecordRepository = {
      findEnrollmentByIdInCampus: jest.fn(),
      findSchoolYearEnrollmentByIdInCampus: jest.fn(),
      findCorrections: jest.fn(),
      appendCorrection: jest.fn(),
      findRetentionPolicy: jest.fn(),
      archiveRecord: jest.fn(),
      redactRecord: jest.fn(),
      deleteRecord: jest.fn(),
    } as unknown as jest.Mocked<HistoricalRecordRepository>;

    useCase = new GetSchoolYearStudentsUseCase(
      syeRepository,
      schoolYearRepository,
      historicalRecordRepository,
    );
  });

  afterEach(() => jest.useRealTimers());

  it("returns paginated school-year enrollment rows with snapshot metadata and no attendance payload", async () => {
    const upcomingParent = parentEnrollment();
    const row: SchoolYearStudentListItem = {
      enrollment: upcomingParent,
      childEnrollmentCount: 1,
      classAssignment: Enrollment.create(
        {
          classId: "class-upcoming",
          studentId: upcomingParent.studentId,
          schoolYearEnrollmentId: upcomingParent.id,
          enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
        },
        "child-upcoming",
      ),
      classAssignmentState: "UPCOMING",
    };
    schoolYearRepository.findById.mockResolvedValue(schoolYear());
    syeRepository.findStudentsBySchoolYear.mockResolvedValue({
      data: [row],
      pagination: {
        count: 1,
        limit: 10,
        offset: 0,
        totalPages: 1,
        currentPage: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
    historicalRecordRepository.findCorrections.mockResolvedValue([]);

    const result = await useCase.execute({
      campusId,
      schoolYearId,
      params: { limit: 10, offset: 0 },
      segment: "upcoming",
      search: "Snapshot",
    });

    expect(syeRepository.findStudentsBySchoolYear).toHaveBeenCalledWith(
      campusId,
      schoolYearId,
      { limit: 10, offset: 0 },
      referenceDate,
      { segment: "upcoming", search: "Snapshot" },
    );
    expect(result.data[0].schoolYearEnrollmentId).toBe(row.enrollment.id);
    expect(result.data[0].segment).toBe("upcoming");
    expect(result.data[0].effectiveStatus).toBe("UPCOMING");
    expect(result.data[0].classAssignment).toMatchObject({
      id: "child-upcoming",
      effectiveStatus: "UPCOMING",
    });
    expect(result.data[0].classAssignmentState).toBe("UPCOMING");
    expect(result.data[0].snapshotAvailability.student).toBe("SNAPSHOT");
    expect(result.data[0]).not.toHaveProperty("attendance");
  });

  it("returns 404 for missing or cross-campus school years before querying rows", async () => {
    schoolYearRepository.findById.mockResolvedValue(
      SchoolYear.create(
        {
          campusId: "other-campus",
          name: "2026-2027",
          startDate: new Date("2026-09-01T00:00:00.000Z"),
          endDate: new Date("2027-06-30T00:00:00.000Z"),
        },
        schoolYearId,
      ),
    );

    await expect(
      useCase.execute({
        campusId,
        schoolYearId,
        params: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(syeRepository.findStudentsBySchoolYear).not.toHaveBeenCalled();
  });

  it("does not label an active parent with an upcoming assignment as unassigned", async () => {
    schoolYearRepository.findById.mockResolvedValue(schoolYear());
    historicalRecordRepository.findCorrections.mockResolvedValue([]);
    const activeParent = parentEnrollment(new Date("2026-07-01T00:00:00.000Z"));
    const activeChild = Enrollment.create(
      {
        classId: "class-1",
        studentId: activeParent.studentId,
        schoolYearEnrollmentId: activeParent.id,
        enrollmentDate: new Date("2026-07-01T00:00:00.000Z"),
      },
      "child-active",
    );
    syeRepository.findStudentsBySchoolYear.mockResolvedValue({
      data: [
        {
          enrollment: activeParent,
          childEnrollmentCount: 1,
          classAssignment: activeChild,
          classAssignmentState: "ACTIVE",
        },
        {
          enrollment: activeParent,
          childEnrollmentCount: 1,
          classAssignment: Enrollment.create(
            {
              classId: "class-2",
              studentId: activeParent.studentId,
              schoolYearEnrollmentId: activeParent.id,
              enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
            },
            "child-upcoming",
          ),
          classAssignmentState: "UPCOMING",
        },
        {
          enrollment: activeParent,
          childEnrollmentCount: 0,
          classAssignment: null,
          classAssignmentState: "NONE",
        },
      ],
      pagination: {
        count: 3,
        limit: 10,
        offset: 0,
        totalPages: 1,
        currentPage: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    const result = await useCase.execute({
      campusId,
      schoolYearId,
      params: {},
    });

    expect(result.data.map((row) => row.segment)).toEqual([
      "active",
      "registered",
      "unassigned",
    ]);
    expect(result.data.map((row) => row.classAssignmentState)).toEqual([
      "ACTIVE",
      "UPCOMING",
      "NONE",
    ]);
  });

  it("retains cancelled registrations with authoritative actor metadata", async () => {
    schoolYearRepository.findById.mockResolvedValue(schoolYear());
    historicalRecordRepository.findCorrections.mockResolvedValue([]);
    const cancelledParent = parentEnrollment().cancel({
      cancelledAt: referenceDate,
      reason: EnrollmentCancellationReason.FAMILY_REQUEST,
      note: "plans changed",
      actorId: "actor-1",
      actorFullName: "Alice Admin",
    });
    syeRepository.findStudentsBySchoolYear.mockResolvedValue({
      data: [
        {
          enrollment: cancelledParent,
          childEnrollmentCount: 0,
          classAssignment: null,
          classAssignmentState: "NONE",
        },
      ],
      pagination: {
        count: 1,
        limit: 10,
        offset: 0,
        totalPages: 1,
        currentPage: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    const result = await useCase.execute({
      campusId,
      schoolYearId,
      params: {},
    });

    expect(result.data[0]).toMatchObject({
      segment: "registered",
      effectiveStatus: "CANCELLED",
      cancellationReason: EnrollmentCancellationReason.FAMILY_REQUEST,
      cancellationNote: "plans changed",
      cancelledBy: { id: "actor-1", fullName: "Alice Admin" },
    });
  });
});
