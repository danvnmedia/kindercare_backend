import { AbsenceRequestRepository } from "@/application/absence-request";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { ClassStaffRepository } from "@/application/class-management/ports/class-staff.repository";
import { EnrollmentRepository } from "@/application/class-management/ports/enrollment.repository";
import { StaffRepository } from "@/application/user-management/ports/staff.repository";
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
import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { Student } from "@/domain/user-management/entities/student.entity";
import { User } from "@/domain/user-management/user.entity";
import {
  RollCallSaveReasonCode,
  RollCallSaveResultStatus,
  SaveClassRollCallUseCase,
} from "./save-class-roll-call.use-case";
import { StudentAttendanceRepository } from "../ports/student-attendance.repository";

const CAMPUS_ID = "00000000-0000-4000-8000-000000000001";
const CLASS_ID = "00000000-0000-4000-8000-000000000002";
const USER_ID = "00000000-0000-4000-8000-000000000003";
const STAFF_ID = "00000000-0000-4000-8000-000000000004";
const DATE = new Date("2026-07-06T00:00:00.000Z");

describe("SaveClassRollCallUseCase", () => {
  let attendanceRepository: jest.Mocked<StudentAttendanceRepository>;
  let classRepository: jest.Mocked<ClassRepository>;
  let enrollmentRepository: jest.Mocked<EnrollmentRepository>;
  let absenceRequestRepository: jest.Mocked<AbsenceRequestRepository>;
  let staffRepository: jest.Mocked<StaffRepository>;
  let classStaffRepository: jest.Mocked<ClassStaffRepository>;
  let useCase: SaveClassRollCallUseCase;

  beforeEach(() => {
    attendanceRepository = {
      findByClassAndDate: jest.fn().mockResolvedValue([]),
      save: jest
        .fn()
        .mockImplementation(
          async (summary: StudentAttendanceSummary) => summary,
        ),
      update: jest
        .fn()
        .mockImplementation(
          async (summary: StudentAttendanceSummary) => summary,
        ),
      saveChangeLogs: jest
        .fn()
        .mockImplementation(async (logs: StudentAttendanceChangeLog[]) => logs),
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
    staffRepository = {
      findByUserId: jest.fn(),
      findByUserIdInCampus: jest.fn().mockResolvedValue(makeStaff()),
    } as unknown as jest.Mocked<StaffRepository>;
    classStaffRepository = {
      findByPair: jest
        .fn()
        .mockResolvedValue(makeClassStaff(ClassStaffRole.HOMEROOM)),
    } as unknown as jest.Mocked<ClassStaffRepository>;

    useCase = new SaveClassRollCallUseCase(
      attendanceRepository,
      classRepository,
      enrollmentRepository,
      absenceRequestRepository,
      staffRepository,
      classStaffRepository,
    );
  });

  it("maps V1 states, persists approved absence evidence, skips NOT_IDENTIFIED, and returns stable row results", async () => {
    const inClass = makeStudent(
      "00000000-0000-4000-8000-000000000101",
      "Student One",
    );
    const withRequest = makeStudent(
      "00000000-0000-4000-8000-000000000102",
      "Student Two",
    );
    const withoutRequest = makeStudent(
      "00000000-0000-4000-8000-000000000103",
      "Student Three",
    );
    const notIdentified = makeStudent(
      "00000000-0000-4000-8000-000000000104",
      "Student Four",
    );
    enrollmentRepository.findActiveByClassIdOnDate.mockResolvedValue([
      makeEnrollment(inClass),
      makeEnrollment(withRequest),
      makeEnrollment(withoutRequest),
      makeEnrollment(notIdentified),
    ]);
    const approvedAbsence = makeAbsenceRequest(
      "00000000-0000-4000-8000-000000000201",
      withRequest.id,
    );
    absenceRequestRepository.findApprovedOverlapsForStudents.mockResolvedValue([
      approvedAbsence,
    ]);

    const result = await useCase.execute({
      campusId: CAMPUS_ID,
      classId: CLASS_ID,
      date: "2026-07-06",
      currentUser: makeUser(),
      rows: [
        { studentId: inClass.id, state: AttendanceRollCallState.IN_CLASS },
        {
          studentId: withRequest.id,
          state: AttendanceRollCallState.ABSENCE_WITH_REQUEST,
        },
        {
          studentId: withoutRequest.id,
          state: AttendanceRollCallState.ABSENCE_WITHOUT_REQUEST,
        },
        {
          studentId: notIdentified.id,
          state: AttendanceRollCallState.NOT_IDENTIFIED,
        },
      ],
    });

    expect(result.rows).toEqual([
      expect.objectContaining({
        studentId: inClass.id,
        result: RollCallSaveResultStatus.SAVED,
        attendanceStatus: AttendanceStatus.PRESENT,
        reasonCode: null,
      }),
      expect.objectContaining({
        studentId: withRequest.id,
        result: RollCallSaveResultStatus.SAVED,
        attendanceStatus: AttendanceStatus.EXCUSED,
        absenceRequestId: approvedAbsence.id,
        reasonCode: null,
      }),
      expect.objectContaining({
        studentId: withoutRequest.id,
        result: RollCallSaveResultStatus.SAVED,
        attendanceStatus: AttendanceStatus.ABSENT,
        reasonCode: null,
      }),
      expect.objectContaining({
        studentId: notIdentified.id,
        result: RollCallSaveResultStatus.SKIPPED,
        reasonCode: RollCallSaveReasonCode.NOT_IDENTIFIED_NOOP,
        attendanceId: null,
      }),
    ]);
    expect(attendanceRepository.save).toHaveBeenCalledTimes(3);
    expect(
      attendanceRepository.save.mock.calls.map(([summary]) => ({
        studentId: summary.studentId,
        status: summary.status,
        absenceRequestId: summary.absenceRequestId,
      })),
    ).toEqual([
      {
        studentId: inClass.id,
        status: AttendanceStatus.PRESENT,
        absenceRequestId: null,
      },
      {
        studentId: withRequest.id,
        status: AttendanceStatus.EXCUSED,
        absenceRequestId: approvedAbsence.id,
      },
      {
        studentId: withoutRequest.id,
        status: AttendanceStatus.ABSENT,
        absenceRequestId: null,
      },
    ]);
    expect(attendanceRepository.saveChangeLogs).not.toHaveBeenCalled();
  });

  it("returns unchanged for idempotent rows without creating timeline entries", async () => {
    const student = makeStudent(
      "00000000-0000-4000-8000-000000000105",
      "Student Five",
    );
    const existing = makeAttendanceSummary({
      id: "00000000-0000-4000-8000-000000000301",
      studentId: student.id,
      status: AttendanceStatus.PRESENT,
      absenceRequestId: null,
      note: "Already checked",
    });
    enrollmentRepository.findActiveByClassIdOnDate.mockResolvedValue([
      makeEnrollment(student),
    ]);
    attendanceRepository.findByClassAndDate.mockResolvedValue([existing]);

    const result = await useCase.execute({
      campusId: CAMPUS_ID,
      classId: CLASS_ID,
      date: "2026-07-06",
      currentUser: makeUser(),
      rows: [
        { studentId: student.id, state: AttendanceRollCallState.IN_CLASS },
      ],
    });

    expect(result.rows[0]).toMatchObject({
      studentId: student.id,
      result: RollCallSaveResultStatus.UNCHANGED,
      attendanceStatus: AttendanceStatus.PRESENT,
      reasonCode: null,
    });
    expect(attendanceRepository.update).not.toHaveBeenCalled();
    expect(attendanceRepository.saveChangeLogs).not.toHaveBeenCalled();
  });

  it("blocks save before mutation when the current user is not homeroom or assistant for the class", async () => {
    const student = makeStudent(
      "00000000-0000-4000-8000-000000000106",
      "Student Six",
    );
    classStaffRepository.findByPair.mockResolvedValue(
      makeClassStaff(ClassStaffRole.BOARDING),
    );

    const result = await useCase.execute({
      campusId: CAMPUS_ID,
      classId: CLASS_ID,
      date: "2026-07-06",
      currentUser: makeUser(),
      rows: [
        { studentId: student.id, state: AttendanceRollCallState.IN_CLASS },
      ],
    });

    expect(result.rows[0]).toMatchObject({
      studentId: student.id,
      result: RollCallSaveResultStatus.PERMISSION_DENIED,
      reasonCode: RollCallSaveReasonCode.CLASS_STAFF_ROLE_REQUIRED,
    });
    expect(
      enrollmentRepository.findActiveByClassIdOnDate,
    ).not.toHaveBeenCalled();
    expect(attendanceRepository.save).not.toHaveBeenCalled();
    expect(attendanceRepository.update).not.toHaveBeenCalled();
  });

  it("allows a global admin to save without a campus staff or class-staff assignment", async () => {
    const student = makeStudent(
      "00000000-0000-4000-8000-000000000110",
      "Student Ten",
    );
    staffRepository.findByUserIdInCampus.mockResolvedValue(null);
    classStaffRepository.findByPair.mockResolvedValue(null);
    enrollmentRepository.findActiveByClassIdOnDate.mockResolvedValue([
      makeEnrollment(student),
    ]);

    const result = await useCase.execute({
      campusId: CAMPUS_ID,
      classId: CLASS_ID,
      date: "2026-07-06",
      currentUser: makeGlobalAdminUser(),
      rows: [
        { studentId: student.id, state: AttendanceRollCallState.IN_CLASS },
      ],
    });

    expect(result.rows[0]).toMatchObject({
      studentId: student.id,
      result: RollCallSaveResultStatus.SAVED,
      attendanceStatus: AttendanceStatus.PRESENT,
      reasonCode: null,
    });
    expect(staffRepository.findByUserIdInCampus).not.toHaveBeenCalled();
    expect(classStaffRepository.findByPair).not.toHaveBeenCalled();
    expect(attendanceRepository.save).toHaveBeenCalledTimes(1);
  });

  it("requires a note when overriding an approved absence to another state", async () => {
    const student = makeStudent(
      "00000000-0000-4000-8000-000000000107",
      "Student Seven",
    );
    const approvedAbsence = makeAbsenceRequest(
      "00000000-0000-4000-8000-000000000202",
      student.id,
    );
    enrollmentRepository.findActiveByClassIdOnDate.mockResolvedValue([
      makeEnrollment(student),
    ]);
    absenceRequestRepository.findApprovedOverlapsForStudents.mockResolvedValue([
      approvedAbsence,
    ]);

    const result = await useCase.execute({
      campusId: CAMPUS_ID,
      classId: CLASS_ID,
      date: "2026-07-06",
      currentUser: makeUser(),
      rows: [
        { studentId: student.id, state: AttendanceRollCallState.IN_CLASS },
      ],
    });

    expect(result.rows[0]).toMatchObject({
      studentId: student.id,
      result: RollCallSaveResultStatus.VALIDATION_ERROR,
      reasonCode:
        RollCallSaveReasonCode.APPROVED_ABSENCE_OVERRIDE_NOTE_REQUIRED,
    });
    expect(attendanceRepository.save).not.toHaveBeenCalled();
    expect(attendanceRepository.update).not.toHaveBeenCalled();
    expect(attendanceRepository.saveChangeLogs).not.toHaveBeenCalled();
  });

  it("updates override with note and records status, note, absence request, and override timeline entries", async () => {
    const student = makeStudent(
      "00000000-0000-4000-8000-000000000108",
      "Student Eight",
    );
    const approvedAbsence = makeAbsenceRequest(
      "00000000-0000-4000-8000-000000000203",
      student.id,
    );
    const existing = makeAttendanceSummary({
      id: "00000000-0000-4000-8000-000000000302",
      studentId: student.id,
      status: AttendanceStatus.EXCUSED,
      absenceRequestId: approvedAbsence.id,
      note: null,
    });
    enrollmentRepository.findActiveByClassIdOnDate.mockResolvedValue([
      makeEnrollment(student),
    ]);
    attendanceRepository.findByClassAndDate.mockResolvedValue([existing]);
    absenceRequestRepository.findApprovedOverlapsForStudents.mockResolvedValue([
      approvedAbsence,
    ]);

    const result = await useCase.execute({
      campusId: CAMPUS_ID,
      classId: CLASS_ID,
      date: "2026-07-06",
      currentUser: makeUser(),
      rows: [
        {
          studentId: student.id,
          state: AttendanceRollCallState.IN_CLASS,
          note: "Parent confirmed arrival",
        },
      ],
    });

    expect(result.rows[0]).toMatchObject({
      studentId: student.id,
      result: RollCallSaveResultStatus.SAVED,
      attendanceStatus: AttendanceStatus.PRESENT,
      absenceRequestId: null,
    });
    expect(attendanceRepository.update).toHaveBeenCalledTimes(1);
    expect(attendanceRepository.update.mock.calls[0][0]).toMatchObject({
      status: AttendanceStatus.PRESENT,
      absenceRequestId: null,
      note: "Parent confirmed arrival",
      updatedById: USER_ID,
    });

    expect(attendanceRepository.saveChangeLogs).toHaveBeenCalledTimes(1);
    const savedLogs = attendanceRepository.saveChangeLogs.mock.calls[0][0];
    expect(savedLogs.map((log) => log.changeType)).toEqual([
      AttendanceChangeType.STATUS_CHANGED,
      AttendanceChangeType.NOTE_CHANGED,
      AttendanceChangeType.ABSENCE_REQUEST_CHANGED,
      AttendanceChangeType.APPROVED_ABSENCE_OVERRIDDEN,
    ]);
    expect(savedLogs.every((log) => log.actorId === USER_ID)).toBe(true);
    expect(
      savedLogs.every((log) => log.note === "Parent confirmed arrival"),
    ).toBe(true);
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

function makeUser(): User {
  return User.create(
    {
      clerkUid: "user_attendancetest",
      isActive: true,
      name: "Teacher",
      email: "teacher@example.com",
    },
    USER_ID,
  );
}

function makeGlobalAdminUser(): User {
  const now = new Date("2026-07-06T00:00:00.000Z");

  return User.reconstitute(
    {
      clerkUid: "user_globaladmintest",
      isActive: true,
      name: "Global Admin",
      email: "admin@example.com",
      roleAssignments: [
        {
          role: {
            id: "00000000-0000-4000-8000-000000000099",
            name: "Super Admin",
            description: "Global system administrator",
            campusId: null,
            isSystemDefault: true,
            isSystemRole: true,
            permissions: [],
            createdAt: now,
            updatedAt: now,
          },
          campusId: null,
          assignedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    USER_ID,
  );
}

function makeStaff(): Staff {
  return Staff.create(
    {
      campusId: CAMPUS_ID,
      staffCode: "ST-2026-000001",
      fullName: "Teacher One",
      email: "teacher@example.com",
      phoneNumber: "+84912345678",
      address: null,
      dateOfBirth: null,
      gender: null,
      userId: USER_ID,
    },
    STAFF_ID,
  );
}

function makeClassStaff(role: ClassStaffRole): ClassStaff {
  return ClassStaff.create({
    classId: CLASS_ID,
    staffId: STAFF_ID,
    role,
  });
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
      updatedById: USER_ID,
      note: input.note ?? null,
    },
    input.id,
  );
}
