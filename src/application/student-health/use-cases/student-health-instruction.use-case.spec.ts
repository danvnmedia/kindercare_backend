import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

import { AuditEventRecorderPort } from "@/application/audit";
import { EnrollmentRepository } from "@/application/class-management/ports/enrollment.repository";
import { EnrollmentEffectiveStatusFilter } from "@/application/class-management/enrollment-effective-status-filter";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { StudentHealthInstructionRepository } from "@/application/student-health";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { Class } from "@/domain/class-management/entities/class.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import {
  StudentHealthInstruction,
  StudentHealthInstructionStatus,
  StudentHealthInstructionType,
} from "@/domain/student-health";
import { Student } from "@/domain/user-management/entities/student.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { User } from "@/domain/user-management/user.entity";

import { CreateStudentHealthInstructionUseCase } from "./create-student-health-instruction.use-case";
import { GetActiveClassHealthInstructionsUseCase } from "./get-active-class-health-instructions.use-case";
import { GetActiveStudentHealthInstructionsUseCase } from "./get-active-student-health-instructions.use-case";
import { GetStudentHealthInstructionsUseCase } from "./get-student-health-instructions.use-case";
import { UpdateStudentHealthInstructionUseCase } from "./update-student-health-instruction.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const OTHER_CAMPUS_ID = "22222222-2222-4222-a222-222222222222";
const STUDENT_ID = "33333333-3333-4333-a333-333333333333";
const STUDENT_ID_2 = "33333333-3333-4333-a333-333333333334";
const INSTRUCTION_ID = "44444444-4444-4444-a444-444444444444";
const CLASS_ID = "66666666-6666-4666-a666-666666666666";
const ACTOR_ID = "55555555-5555-4555-a555-555555555555";

const CURRENT_USER = {
  id: ACTOR_ID,
  profile: { fullName: "School Nurse" },
} as User;

function makeStudent(
  id = STUDENT_ID,
  overrides: Partial<{ campusId: string; isArchived: boolean }> = {},
) {
  return Student.create(
    {
      campusId: overrides.campusId ?? CAMPUS_ID,
      studentCode: id === STUDENT_ID ? "STU-001" : "STU-002",
      fullName: id === STUDENT_ID ? "Alice Student" : "Bob Student",
      email: null,
      phoneNumber: null,
      address: null,
      dateOfBirth: null,
      nickname: null,
      gender: Gender.FEMALE,
      isArchived: overrides.isArchived ?? false,
    },
    id,
  );
}

function makeInstruction(
  overrides: Partial<{
    studentId: string;
    startDate: string;
    endDate: string | null;
    isActive: boolean;
    timesOfDay: string[];
  }> = {},
) {
  return StudentHealthInstruction.create(
    {
      campusId: CAMPUS_ID,
      studentId: overrides.studentId ?? STUDENT_ID,
      instructionType: StudentHealthInstructionType.MEDICATION,
      title: "Antibiotic after lunch",
      instruction: "Give the medication after lunch with water.",
      dosage: "5 ml",
      startDate: overrides.startDate ?? "2026-07-01",
      endDate: Object.prototype.hasOwnProperty.call(overrides, "endDate")
        ? overrides.endDate
        : "2026-07-05",
      timesOfDay: overrides.timesOfDay ?? ["12:30"],
      scheduleNotes: "After lunch only.",
      notes: "Call guardian if vomiting occurs.",
      isActive: overrides.isActive ?? true,
      createdByUserId: ACTOR_ID,
      createdBy: { id: ACTOR_ID, fullName: "School Nurse" },
    },
    INSTRUCTION_ID,
  );
}

function makeClass(campusId = CAMPUS_ID) {
  return Class.create(
    {
      name: "Sunflower",
      description: null,
      campusId,
      gradeLevelId: "77777777-7777-4777-a777-777777777777",
      schoolYearId: "88888888-8888-4888-a888-888888888888",
    },
    CLASS_ID,
  );
}

function makeEnrollment(student: Student) {
  return Enrollment.create({
    classId: CLASS_ID,
    studentId: student.id,
    schoolYearEnrollmentId: "99999999-9999-4999-a999-999999999999",
    enrollmentDate: new Date("2026-06-01T00:00:00.000Z"),
    endDate: null,
    exitReason: null,
    note: null,
    student,
    class: makeClass(),
  });
}

function makeClosedEnrollmentActiveOnDate(student: Student) {
  return Enrollment.create({
    classId: CLASS_ID,
    studentId: student.id,
    schoolYearEnrollmentId: "99999999-9999-4999-a999-999999999998",
    enrollmentDate: new Date("2026-06-01T00:00:00.000Z"),
    endDate: new Date("2026-07-03T00:00:00.000Z"),
    exitReason: "WITHDRAWN" as never,
    note: null,
    student,
    class: makeClass(),
  });
}

describe("Student health instruction use cases", () => {
  let instructionRepository: jest.Mocked<StudentHealthInstructionRepository>;
  let studentRepository: jest.Mocked<StudentRepository>;
  let classRepository: jest.Mocked<ClassRepository>;
  let enrollmentRepository: jest.Mocked<EnrollmentRepository>;
  let transactionRunner: jest.Mocked<TransactionRunnerPort>;
  let auditRecorder: jest.Mocked<AuditEventRecorderPort>;

  beforeEach(() => {
    instructionRepository = {
      findByStudentInCampus: jest.fn(),
      findByIdForStudentInCampus: jest.fn(),
      findActiveByStudentInCampus: jest.fn(),
      findActiveByStudentsInCampus: jest.fn(),
      create: jest.fn(async (instruction) => instruction),
      archiveIfActive: jest.fn(async (instruction) => instruction),
      updateIfActive: jest.fn(async (instruction) => instruction),
    } as unknown as jest.Mocked<StudentHealthInstructionRepository>;
    studentRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<StudentRepository>;
    classRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ClassRepository>;
    enrollmentRepository = {
      findByClassIdAndEffectiveStatus: jest.fn(),
      findActiveByClassIdOnDate: jest.fn(),
    } as unknown as jest.Mocked<EnrollmentRepository>;
    transactionRunner = {
      run: jest.fn(async (task) => task({} as never)),
    } as unknown as jest.Mocked<TransactionRunnerPort>;
    auditRecorder = {
      record: jest.fn(async () => undefined),
    } as unknown as jest.Mocked<AuditEventRecorderPort>;
  });

  it("derives instruction status from active flag and date range", () => {
    expect(makeInstruction().getStatus("2026-06-30")).toBe(
      StudentHealthInstructionStatus.UPCOMING,
    );
    expect(makeInstruction().getStatus("2026-07-02")).toBe(
      StudentHealthInstructionStatus.ACTIVE,
    );
    expect(makeInstruction().getStatus("2026-07-06")).toBe(
      StudentHealthInstructionStatus.EXPIRED,
    );
    expect(makeInstruction({ isActive: false }).getStatus("2026-07-02")).toBe(
      StudentHealthInstructionStatus.INACTIVE,
    );
  });

  it("creates an instruction with normalized schedule and mutation audit", async () => {
    studentRepository.findById.mockResolvedValue(makeStudent());

    const useCase = new CreateStudentHealthInstructionUseCase(
      instructionRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    const result = await useCase.execute(
      CAMPUS_ID,
      STUDENT_ID,
      {
        instructionType: StudentHealthInstructionType.MEDICATION,
        title: "  Antibiotic after lunch  ",
        instruction: "  Give with water.  ",
        startDate: "2026-07-01",
        endDate: "2026-07-05",
        timesOfDay: ["16:00", "12:30", "12:30"],
      },
      CURRENT_USER,
    );

    expect(result.timesOfDay).toEqual(["12:30", "16:00"]);
    expect(instructionRepository.create).toHaveBeenCalledWith(result, {});
    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ACTOR_ID,
        action: "CREATE_STUDENT_HEALTH_INSTRUCTION",
        targetType: "student_health_instruction",
        campusId: CAMPUS_ID,
        context: {
          actorName: "School Nurse",
          studentId: STUDENT_ID,
        },
      }),
      {},
    );
  });

  it("rejects invalid instruction payloads before loading student data", async () => {
    const useCase = new CreateStudentHealthInstructionUseCase(
      instructionRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        {
          instructionType: StudentHealthInstructionType.MEDICATION,
          title: " ",
          instruction: "Give with water.",
          startDate: "2026-07-01",
        },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        {
          instructionType: StudentHealthInstructionType.MEDICATION,
          title: "Medicine",
          instruction: "Give with water.",
          startDate: "2026-07-05",
          endDate: "2026-07-01",
        },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        {
          instructionType: StudentHealthInstructionType.MEDICATION,
          title: "Medicine",
          instruction: "Give with water.",
          startDate: "2026-07-01",
          timesOfDay: ["24:00"],
        },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        {
          instructionType: StudentHealthInstructionType.MEDICATION,
          title: "Medicine",
          instruction: "Give with water.",
          startDate: "2026-07-01",
          status: "ACTIVE",
        } as never,
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(studentRepository.findById).not.toHaveBeenCalled();
    expect(instructionRepository.create).not.toHaveBeenCalled();
  });

  it("updates allowed fields, rejects archived student writes, and audits diffs", async () => {
    const instruction = makeInstruction();
    studentRepository.findById.mockResolvedValue(makeStudent());
    instructionRepository.findByIdForStudentInCampus.mockResolvedValue(
      instruction,
    );

    const useCase = new UpdateStudentHealthInstructionUseCase(
      instructionRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    const result = await useCase.execute(
      CAMPUS_ID,
      STUDENT_ID,
      INSTRUCTION_ID,
      { endDate: "2026-07-06", timesOfDay: ["16:00", "12:30"] },
      CURRENT_USER,
    );

    expect(result.endDate?.toISOString().slice(0, 10)).toBe("2026-07-06");
    expect(result.timesOfDay).toEqual(["12:30", "16:00"]);
    expect(instructionRepository.updateIfActive).toHaveBeenCalledWith(
      instruction,
      {},
    );
    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE_STUDENT_HEALTH_INSTRUCTION",
        beforeValue: expect.objectContaining({ endDate: "2026-07-05" }),
        afterValue: expect.objectContaining({ endDate: "2026-07-06" }),
      }),
      {},
    );

    studentRepository.findById.mockResolvedValue(
      makeStudent(STUDENT_ID, { isArchived: true }),
    );
    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        INSTRUCTION_ID,
        { notes: "Updated" },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns conflict without audit when archival wins an update race", async () => {
    studentRepository.findById.mockResolvedValue(makeStudent());
    instructionRepository.findByIdForStudentInCampus.mockResolvedValue(
      makeInstruction(),
    );
    instructionRepository.updateIfActive.mockResolvedValue(null);
    const useCase = new UpdateStudentHealthInstructionUseCase(
      instructionRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        INSTRUCTION_ID,
        { notes: "Updated note" },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(auditRecorder.record).not.toHaveBeenCalled();
  });

  it("lists instructions after campus student validation and passes derived-status params", async () => {
    const params = {
      status: StudentHealthInstructionStatus.ACTIVE,
      date: "2026-07-02",
      limit: 10,
      offset: 0,
    };
    const result = { data: [makeInstruction()], pagination: {} as never };
    studentRepository.findById.mockResolvedValue(makeStudent());
    instructionRepository.findByStudentInCampus.mockResolvedValue(result);

    const useCase = new GetStudentHealthInstructionsUseCase(
      instructionRepository,
      studentRepository,
    );

    await expect(
      useCase.execute({ campusId: CAMPUS_ID, studentId: STUDENT_ID, params }),
    ).resolves.toBe(result);
    expect(instructionRepository.findByStudentInCampus).toHaveBeenCalledWith(
      CAMPUS_ID,
      STUDENT_ID,
      params,
    );

    studentRepository.findById.mockResolvedValue(
      makeStudent(STUDENT_ID, { campusId: OTHER_CAMPUS_ID }),
    );
    await expect(
      useCase.execute({ campusId: CAMPUS_ID, studentId: STUDENT_ID, params }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns active student instructions without mutation side effects", async () => {
    const instruction = makeInstruction();
    studentRepository.findById.mockResolvedValue(makeStudent());
    instructionRepository.findActiveByStudentInCampus.mockResolvedValue([
      instruction,
    ]);

    const useCase = new GetActiveStudentHealthInstructionsUseCase(
      instructionRepository,
      studentRepository,
    );

    const result = await useCase.execute({
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
      date: "2026-07-02",
    });

    expect(result).toMatchObject({
      studentId: STUDENT_ID,
      campusId: CAMPUS_ID,
      date: "2026-07-02",
      instructions: [
        {
          id: INSTRUCTION_ID,
          status: "ACTIVE",
          title: "Antibiotic after lunch",
        },
      ],
    });
    expect(instructionRepository.create).not.toHaveBeenCalled();
    expect(instructionRepository.updateIfActive).not.toHaveBeenCalled();
  });

  it("groups active class instructions by active campus students only", async () => {
    const studentOne = makeStudent(STUDENT_ID);
    const studentTwo = makeStudent(STUDENT_ID_2);
    classRepository.findById.mockResolvedValue(makeClass());
    enrollmentRepository.findByClassIdAndEffectiveStatus.mockResolvedValue([
      makeEnrollment(studentOne),
      makeClosedEnrollmentActiveOnDate(studentTwo),
    ]);
    instructionRepository.findActiveByStudentsInCampus.mockResolvedValue([
      makeInstruction({ studentId: STUDENT_ID_2 }),
    ]);

    const useCase = new GetActiveClassHealthInstructionsUseCase(
      instructionRepository,
      classRepository,
      enrollmentRepository,
    );

    const result = await useCase.execute({
      campusId: CAMPUS_ID,
      classId: CLASS_ID,
      date: "2026-07-02",
    });

    expect(
      enrollmentRepository.findByClassIdAndEffectiveStatus,
    ).toHaveBeenCalledWith(
      CLASS_ID,
      EnrollmentEffectiveStatusFilter.ACTIVE,
      new Date("2026-07-02T00:00:00.000Z"),
    );
    expect(
      instructionRepository.findActiveByStudentsInCampus,
    ).toHaveBeenCalledWith(
      CAMPUS_ID,
      [STUDENT_ID, STUDENT_ID_2],
      new Date("2026-07-02T00:00:00.000Z"),
    );
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      student: { id: STUDENT_ID, fullName: "Alice Student" },
      instructions: [],
    });
    expect(result.items[1]).toMatchObject({
      student: { id: STUDENT_ID_2, fullName: "Bob Student" },
      instructions: [{ id: INSTRUCTION_ID, status: "ACTIVE" }],
    });

    classRepository.findById.mockResolvedValue(makeClass(OTHER_CAMPUS_ID));
    await expect(
      useCase.execute({
        campusId: CAMPUS_ID,
        classId: CLASS_ID,
        date: "2026-07-02",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
