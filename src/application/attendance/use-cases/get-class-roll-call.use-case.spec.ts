import { BadRequestException } from "@nestjs/common";
import { AbsenceRequestRepository } from "@/application/absence-request";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { EnrollmentRepository } from "@/application/class-management/ports/enrollment.repository";
import {
  AttendanceChangeType,
  AttendanceRollCallState,
  AttendanceStatus,
  StudentAttendanceChangeLog,
  StudentAttendanceSummary,
} from "@/domain/attendance";
import {
  AbsenceRequest,
  AbsenceRequestStatus,
  AbsenceRequestType,
} from "@/domain/absence-request";
import { Class } from "@/domain/class-management/entities/class.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { Student } from "@/domain/user-management/entities/student.entity";
import { GetClassRollCallUseCase } from "./get-class-roll-call.use-case";
import { StudentAttendanceRepository } from "../ports/student-attendance.repository";
import { UserRepository } from "@/application/user-management/ports/user.repository";
import { User } from "@/domain/user-management/user.entity";

const CAMPUS_ID = "00000000-0000-4000-8000-000000000001";
const CLASS_ID = "00000000-0000-4000-8000-000000000002";
const DATE = new Date("2026-07-06T00:00:00.000Z");

describe("GetClassRollCallUseCase", () => {
  let attendanceRepository: jest.Mocked<StudentAttendanceRepository>;
  let classRepository: jest.Mocked<ClassRepository>;
  let enrollmentRepository: jest.Mocked<EnrollmentRepository>;
  let absenceRequestRepository: jest.Mocked<AbsenceRequestRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let useCase: GetClassRollCallUseCase;

  beforeEach(() => {
    attendanceRepository = {
      findByClassAndDate: jest.fn().mockResolvedValue([]),
      findChangeLogsBySummaryIds: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<StudentAttendanceRepository>;
    classRepository = {
      findById: jest.fn().mockResolvedValue(makeClass()),
    } as unknown as jest.Mocked<ClassRepository>;
    enrollmentRepository = {
      findActiveByClassIdOnDate: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<EnrollmentRepository>;
    absenceRequestRepository = {
      findApprovedOverlapsForStudents: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<AbsenceRequestRepository>;
    userRepository = {
      findByIds: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<UserRepository>;
    useCase = new GetClassRollCallUseCase(
      attendanceRepository,
      classRepository,
      enrollmentRepository,
      absenceRequestRepository,
      userRepository,
    );
  });

  it("bulk-resolves deduplicated timeline actors and preserves unresolved actors as null", async () => {
    const student = makeStudent(
      "00000000-0000-4000-8000-000000000101",
      "Student One",
    );
    const summary = makeAttendanceSummary({
      id: "00000000-0000-4000-8000-000000000301",
      studentId: student.id,
      status: AttendanceStatus.PRESENT,
      absenceRequestId: null,
    });
    const resolvedActorId = "00000000-0000-4000-8000-000000000901";
    const deletedActorId = "00000000-0000-4000-8000-000000000902";
    enrollmentRepository.findActiveByClassIdOnDate.mockResolvedValue([
      makeEnrollment(student),
    ]);
    attendanceRepository.findByClassAndDate.mockResolvedValue([summary]);
    attendanceRepository.findChangeLogsBySummaryIds.mockResolvedValue([
      makeChangeLog(
        summary.id,
        resolvedActorId,
        "00000000-0000-4000-8000-000000000401",
      ),
      makeChangeLog(
        summary.id,
        resolvedActorId,
        "00000000-0000-4000-8000-000000000402",
      ),
      makeChangeLog(
        summary.id,
        deletedActorId,
        "00000000-0000-4000-8000-000000000403",
      ),
    ]);
    userRepository.findByIds.mockResolvedValue([
      makeUser(resolvedActorId, "Teacher Nguyen"),
    ]);

    const sheet = await useCase.execute({
      campusId: CAMPUS_ID,
      classId: CLASS_ID,
      date: "2026-07-06",
    });

    expect(userRepository.findByIds).toHaveBeenCalledTimes(1);
    expect(userRepository.findByIds).toHaveBeenCalledWith([
      resolvedActorId,
      deletedActorId,
    ]);
    expect(sheet.rows[0].timeline).toEqual([
      expect.objectContaining({
        actorId: resolvedActorId,
        actor: {
          id: resolvedActorId,
          displayName: "Teacher Nguyen",
          email: "teacher@example.com",
        },
      }),
      expect.objectContaining({
        actorId: resolvedActorId,
        actor: {
          id: resolvedActorId,
          displayName: "Teacher Nguyen",
          email: "teacher@example.com",
        },
      }),
      expect.objectContaining({ actorId: deletedActorId, actor: null }),
    ]);
  });

  it("does not query users when the sheet has no timeline entries", async () => {
    await useCase.execute({
      campusId: CAMPUS_ID,
      classId: CLASS_ID,
      date: "2026-07-06",
    });

    expect(userRepository.findByIds).not.toHaveBeenCalled();
  });

  it("bulk-resolves more than 50 unique timeline actors without pagination truncation", async () => {
    const student = makeStudent(
      "00000000-0000-4000-8000-000000000101",
      "Student One",
    );
    const summary = makeAttendanceSummary({
      id: "00000000-0000-4000-8000-000000000301",
      studentId: student.id,
      status: AttendanceStatus.PRESENT,
      absenceRequestId: null,
    });
    const actorIds = Array.from(
      { length: 51 },
      (_, index) =>
        `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    );
    enrollmentRepository.findActiveByClassIdOnDate.mockResolvedValue([
      makeEnrollment(student),
    ]);
    attendanceRepository.findByClassAndDate.mockResolvedValue([summary]);
    attendanceRepository.findChangeLogsBySummaryIds.mockResolvedValue(
      actorIds.map((actorId, index) =>
        makeChangeLog(summary.id, actorId, `change-log-${index}`),
      ),
    );
    userRepository.findByIds.mockResolvedValue(
      actorIds.map((actorId, index) =>
        makeUser(actorId, `Teacher ${index + 1}`),
      ),
    );

    const sheet = await useCase.execute({
      campusId: CAMPUS_ID,
      classId: CLASS_ID,
      date: "2026-07-06",
    });

    expect(userRepository.findByIds).toHaveBeenCalledWith(actorIds);
    expect(sheet.rows[0].timeline).toHaveLength(51);
    expect(sheet.rows[0].timeline.every((entry) => entry.actor !== null)).toBe(
      true,
    );
  });

  it("preserves timeline rows with null actors when bulk resolution fails", async () => {
    const student = makeStudent(
      "00000000-0000-4000-8000-000000000101",
      "Student One",
    );
    const summary = makeAttendanceSummary({
      id: "00000000-0000-4000-8000-000000000301",
      studentId: student.id,
      status: AttendanceStatus.PRESENT,
      absenceRequestId: null,
    });
    const actorId = "00000000-0000-4000-8000-000000000901";
    enrollmentRepository.findActiveByClassIdOnDate.mockResolvedValue([
      makeEnrollment(student),
    ]);
    attendanceRepository.findByClassAndDate.mockResolvedValue([summary]);
    attendanceRepository.findChangeLogsBySummaryIds.mockResolvedValue([
      makeChangeLog(
        summary.id,
        actorId,
        "00000000-0000-4000-8000-000000000401",
      ),
    ]);
    userRepository.findByIds.mockRejectedValue(new Error("lookup failed"));

    const sheet = await useCase.execute({
      campusId: CAMPUS_ID,
      classId: CLASS_ID,
      date: "2026-07-06",
    });

    expect(sheet.rows[0].timeline[0]).toEqual(
      expect.objectContaining({ actorId, actor: null }),
    );
  });

  it("derives V1 row states, approved absence context, warnings, and timeline", async () => {
    const studentWithApprovedAbsence = makeStudent(
      "00000000-0000-4000-8000-000000000101",
      "Student One",
    );
    const studentWithConflict = makeStudent(
      "00000000-0000-4000-8000-000000000102",
      "Student Two",
    );
    const studentWithoutData = makeStudent(
      "00000000-0000-4000-8000-000000000103",
      "Student Three",
    );
    const studentWithSavedExcused = makeStudent(
      "00000000-0000-4000-8000-000000000104",
      "Student Four",
    );
    enrollmentRepository.findActiveByClassIdOnDate.mockResolvedValue([
      makeEnrollment(studentWithApprovedAbsence),
      makeEnrollment(studentWithConflict),
      makeEnrollment(studentWithoutData),
      makeEnrollment(studentWithSavedExcused),
    ]);

    const approvedAbsence = makeAbsenceRequest(
      "00000000-0000-4000-8000-000000000201",
      studentWithApprovedAbsence.id,
    );
    const conflictingAbsence = makeAbsenceRequest(
      "00000000-0000-4000-8000-000000000202",
      studentWithConflict.id,
    );
    const savedExcusedAbsence = makeAbsenceRequest(
      "00000000-0000-4000-8000-000000000203",
      studentWithSavedExcused.id,
    );
    absenceRequestRepository.findApprovedOverlapsForStudents.mockResolvedValue([
      approvedAbsence,
      conflictingAbsence,
      savedExcusedAbsence,
    ]);

    const presentSummary = makeAttendanceSummary({
      id: "00000000-0000-4000-8000-000000000301",
      studentId: studentWithConflict.id,
      status: AttendanceStatus.PRESENT,
      absenceRequestId: null,
      note: "Came in",
    });
    const excusedSummary = makeAttendanceSummary({
      id: "00000000-0000-4000-8000-000000000302",
      studentId: studentWithSavedExcused.id,
      status: AttendanceStatus.EXCUSED,
      absenceRequestId: savedExcusedAbsence.id,
      note: "Approved",
    });
    attendanceRepository.findByClassAndDate.mockResolvedValue([
      presentSummary,
      excusedSummary,
    ]);
    attendanceRepository.findChangeLogsBySummaryIds.mockResolvedValue([
      StudentAttendanceChangeLog.create(
        {
          attendanceSummaryId: excusedSummary.id,
          changeType: AttendanceChangeType.STATUS_CHANGED,
          previousValue: { status: AttendanceStatus.ABSENT },
          newValue: { status: AttendanceStatus.EXCUSED },
          actorId: "00000000-0000-4000-8000-000000000901",
          note: "Approved",
          createdAt: new Date("2026-07-06T03:00:00.000Z"),
        },
        "00000000-0000-4000-8000-000000000401",
      ),
    ]);

    const sheet = await useCase.execute({
      campusId: CAMPUS_ID,
      classId: CLASS_ID,
      date: "2026-07-06",
    });

    expect(sheet.date).toBe("2026-07-06");
    expect(sheet.rows).toHaveLength(4);
    expect(sheet.rows[0]).toMatchObject({
      studentId: studentWithApprovedAbsence.id,
      state: AttendanceRollCallState.ABSENCE_WITH_REQUEST,
      absenceRequestId: approvedAbsence.id,
      attendanceId: null,
      hasApprovedAbsenceWarning: false,
    });
    expect(sheet.rows[1]).toMatchObject({
      studentId: studentWithConflict.id,
      state: AttendanceRollCallState.IN_CLASS,
      attendanceStatus: AttendanceStatus.PRESENT,
      hasApprovedAbsenceWarning: true,
    });
    expect(sheet.rows[2]).toMatchObject({
      studentId: studentWithoutData.id,
      state: AttendanceRollCallState.NOT_IDENTIFIED,
      absenceRequestId: null,
    });
    expect(sheet.rows[3]).toMatchObject({
      studentId: studentWithSavedExcused.id,
      state: AttendanceRollCallState.ABSENCE_WITH_REQUEST,
      absenceRequestId: savedExcusedAbsence.id,
      hasApprovedAbsenceWarning: false,
    });
    expect(sheet.rows[3].timeline).toHaveLength(1);
    expect(sheet.rows[3].timeline[0].changeType).toBe(
      AttendanceChangeType.STATUS_CHANGED,
    );
    expect(
      absenceRequestRepository.findApprovedOverlapsForStudents,
    ).toHaveBeenCalledWith(
      CAMPUS_ID,
      [
        studentWithApprovedAbsence.id,
        studentWithConflict.id,
        studentWithoutData.id,
        studentWithSavedExcused.id,
      ],
      DATE,
    );
  });

  it("rejects non-date-only input before loading repositories", async () => {
    await expect(
      useCase.execute({
        campusId: CAMPUS_ID,
        classId: CLASS_ID,
        date: "2026-07-06T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(classRepository.findById).not.toHaveBeenCalled();
  });
});

function makeClass(): Class {
  return Class.create(
    {
      name: "Stars",
      campusId: CAMPUS_ID,
      gradeLevelId: "00000000-0000-4000-8000-000000000011",
      schoolYearId: "00000000-0000-4000-8000-000000000012",
      description: null,
    },
    CLASS_ID,
  );
}

function makeStudent(id: string, fullName: string): Student {
  return Student.create(
    {
      campusId: CAMPUS_ID,
      studentCode: id.slice(-6),
      fullName,
      email: null,
      phoneNumber: null,
      address: null,
      dateOfBirth: null,
      nickname: null,
      gender: null,
    },
    id,
  );
}

function makeEnrollment(student: Student): Enrollment {
  return Enrollment.create(
    {
      classId: CLASS_ID,
      studentId: student.id,
      schoolYearEnrollmentId: "00000000-0000-4000-8000-000000000013",
      enrollmentDate: new Date("2026-01-01T00:00:00.000Z"),
      student,
    },
    `enrollment-${student.id}`,
  );
}

function makeAbsenceRequest(id: string, studentId: string): AbsenceRequest {
  return AbsenceRequest.create(
    {
      campusId: CAMPUS_ID,
      studentId,
      requesterGuardianId: "00000000-0000-4000-8000-000000000014",
      absenceType: AbsenceRequestType.FULL_DAY,
      startDate: DATE,
      endDate: DATE,
      description: "Family reason",
      status: AbsenceRequestStatus.APPROVED,
      reviewedById: "00000000-0000-4000-8000-000000000015",
      reviewedAt: new Date("2026-07-05T03:00:00.000Z"),
      reviewNote: "Approved",
    },
    id,
  );
}

function makeAttendanceSummary(input: {
  id: string;
  studentId: string;
  status: AttendanceStatus;
  absenceRequestId: string | null;
  note?: string | null;
}): StudentAttendanceSummary {
  return StudentAttendanceSummary.create(
    {
      campusId: CAMPUS_ID,
      classId: CLASS_ID,
      studentId: input.studentId,
      date: DATE,
      status: input.status,
      absenceRequestId: input.absenceRequestId,
      updatedById: "00000000-0000-4000-8000-000000000901",
      note: input.note ?? null,
    },
    input.id,
  );
}

function makeChangeLog(
  attendanceSummaryId: string,
  actorId: string,
  id: string,
): StudentAttendanceChangeLog {
  return StudentAttendanceChangeLog.create(
    {
      attendanceSummaryId,
      changeType: AttendanceChangeType.STATUS_CHANGED,
      previousValue: { status: AttendanceStatus.ABSENT },
      newValue: { status: AttendanceStatus.PRESENT },
      actorId,
      note: null,
    },
    id,
  );
}

function makeUser(id: string, fullName: string): User {
  return User.reconstitute(
    {
      clerkUid: `clerk-${id}`,
      isActive: true,
      profiles: [
        {
          type: "staff",
          id: `staff-${id}`,
          campusId: CAMPUS_ID,
          fullName,
          email: "teacher@example.com",
          phoneNumber: null,
          dateOfBirth: null,
          gender: null,
        },
      ],
      createdAt: DATE,
      updatedAt: DATE,
    },
    id,
  );
}
