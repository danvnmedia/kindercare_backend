/**
 * Audit-write atomicity — integration coverage (AC-4 of
 * @doc/specs/admin-audit-log).
 *
 * Each action group in v1 has its own use-case unit spec that mocks the
 * recorder (or `tx.recordAudit`) to throw and asserts the use-case rejects.
 * What no single unit spec proves is the cross-group invariant: every group's
 * mutation runs inside a transaction wrapper (`TransactionRunnerPort.run` or
 * `UnitOfWorkPort.run`) such that an audit-emit failure aborts the whole
 * closure — so a real DB rolls back the mutation as well.
 *
 * This suite re-asserts that invariant once per action group, by:
 *   1. Wiring the real use case against mocked ports + a mock runner/UoW
 *      whose `run` invokes the closure synchronously.
 *   2. Forcing the audit-emit call to throw inside that closure.
 *   3. Asserting the use case rejects with the audit error AND the entity
 *      write was issued first inside the same closure (proves it would be
 *      rolled back at the DB layer).
 *
 * Coverage:
 *   - ENROLL  → EnrollStudentUseCase           (runner + recorder)
 *   - EDIT    → UpdateStudentUseCase           (UoW + tx.recordAudit)
 *   - ARCHIVE → ArchiveStudentUseCase          (UoW + tx.recordAudit)
 *   - CREATE  → CreateStudentUseCase           (UoW + tx.recordAudit)
 *   - LINK    → LinkStudentWithGuardianUseCase (UoW + tx.recordAudit)
 *
 * Scenario 2 in the spec.
 */

import { EnrollStudentUseCase } from "@/application/class-management/use-cases/enrollment/enroll-student.use-case";
import { EnrollmentRepository } from "@/application/class-management/ports/enrollment.repository";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { SchoolYearEnrollmentRepository } from "@/application/class-management/ports/school-year-enrollment.repository";
import { GuardianRelationshipTypeRepository } from "@/application/user-management/ports/guardian-relationship-type.repository";
import { StudentCodeGeneratorPort } from "@/application/ports/student-code-generator.port";
import { IdentityPort } from "@/application/ports/identity.port";
import { ArchiveStudentUseCase } from "@/application/user-management/use-cases/student/archive-student.use-case";
import { CreateStudentUseCase } from "@/application/user-management/use-cases/student/create-student.use-case";
import { LinkStudentWithGuardianUseCase } from "@/application/user-management/use-cases/student/link-student-with-guardian.use-case";
import { UpdateStudentUseCase } from "@/application/user-management/use-cases/student/update-student.use-case";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import {
  AppTransactionClient,
  TransactionRunnerPort,
} from "@/application/ports/transaction-runner.port";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { Class } from "@/domain/class-management/entities/class.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { User } from "@/domain/user-management/user.entity";
import {
  createGuardian,
  createMockGuardianRepository,
  createMockStudentRepository,
  createStudent,
  DEFAULT_CAMPUS_ID_A,
} from "@/test-utils";

const CAMPUS_ID = DEFAULT_CAMPUS_ID_A;
const STUDENT_ID = "33333333-3333-4333-a333-333333333333";
const GUARDIAN_ID = "44444444-4444-4444-a444-444444444444";
const CLASS_ID = "55555555-5555-4555-a555-555555555555";
const SCHOOL_YEAR_ID = "66666666-6666-4666-a666-666666666666";
const GRADE_LEVEL_ID = "77777777-7777-4777-a777-777777777777";
const PARENT_SYE_ID = "88888888-8888-4888-a888-888888888888";
const REL_ID = "rel-mother";

const AUDIT_ERROR = new Error("audit failure (atomicity probe)");

function buildActor(): User {
  return User.reconstitute(
    {
      clerkUid: "user_audit12345",
      isActive: true,
      profile: {
        type: "staff",
        id: "actor-1",
        fullName: "Alice Nguyen",
        email: null,
        phoneNumber: null,
        dateOfBirth: null,
        gender: null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    "actor-1",
  );
}

interface Scenario {
  /** Invoke the real use case with valid inputs. Expected to reject. */
  invoke: () => Promise<unknown>;
  /** Spy on the entity-write call that runs BEFORE audit-emit inside the tx. */
  entityWriteSpy: jest.Mock;
  /** Spy on the audit-emit call that has been forced to throw. */
  auditSpy: jest.Mock;
  /** Spy on `run` (runner or UoW). Used to assert the closure executed. */
  runSpy: jest.Mock;
}

// ────────────────────────────────────────────────────────────────────────────
// ENROLL — uses TransactionRunnerPort + AuditEventRecorderPort directly.
// ────────────────────────────────────────────────────────────────────────────
function buildEnrollScenario(): Scenario {
  const enrollmentRepository = {
    findById: jest.fn(),
    findByStudentClassDate: jest.fn().mockResolvedValue(null),
    findByClassId: jest.fn(),
    findByStudentId: jest.fn(),
    findActiveByStudentId: jest.fn().mockResolvedValue(null),
    findActiveByClassId: jest.fn(),
    findHistoricalByClassId: jest.fn(),
    findAllByStudentId: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn().mockImplementation(async (e) => e),
    update: jest.fn(),
    transferEnrollment: jest.fn(),
    saveMany: jest.fn(),
  } as unknown as jest.Mocked<EnrollmentRepository>;

  const schoolYear = SchoolYear.create(
    {
      campusId: CAMPUS_ID,
      name: "Test Year",
      startDate: new Date("2020-01-01T00:00:00.000Z"),
      endDate: new Date("2030-12-31T00:00:00.000Z"),
    },
    SCHOOL_YEAR_ID,
  );
  const classEntity = Class.create(
    {
      name: "Roses",
      campusId: CAMPUS_ID,
      gradeLevelId: GRADE_LEVEL_ID,
      schoolYearId: SCHOOL_YEAR_ID,
      description: null,
      schoolYear,
    },
    CLASS_ID,
  );
  const classRepository = {
    findById: jest.fn().mockResolvedValue(classEntity),
  } as unknown as jest.Mocked<ClassRepository>;

  const studentRepository = createMockStudentRepository();
  studentRepository.findById.mockResolvedValue(
    createStudent({ id: STUDENT_ID, campusId: CAMPUS_ID }),
  );

  const parent = SchoolYearEnrollment.create(
    {
      studentId: STUDENT_ID,
      campusId: CAMPUS_ID,
      schoolYearId: SCHOOL_YEAR_ID,
      gradeLevelId: GRADE_LEVEL_ID,
      enrollmentDate: new Date("2023-09-01T00:00:00.000Z"),
      exitDate: null,
      exitReason: null,
      note: null,
    },
    PARENT_SYE_ID,
  );
  const syeRepository = {
    findById: jest.fn(),
    findOpenByStudentAndSchoolYear: jest.fn().mockResolvedValue(parent),
    findAllByStudentId: jest.fn(),
    findAllByStudentIdWithChildCount: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    withdrawWithChildren: jest.fn(),
  } as unknown as jest.Mocked<SchoolYearEnrollmentRepository>;

  const stubTx = {} as AppTransactionClient;
  const runSpy = jest.fn(
    (task: (tx: AppTransactionClient) => Promise<unknown>) => task(stubTx),
  );
  const runner = { run: runSpy } as unknown as TransactionRunnerPort;

  const auditSpy = jest.fn().mockRejectedValue(AUDIT_ERROR);
  const recorder = { record: auditSpy } as unknown as AuditEventRecorderPort;

  const useCase = new EnrollStudentUseCase(
    enrollmentRepository,
    classRepository,
    studentRepository,
    syeRepository,
    runner,
    recorder,
  );

  return {
    invoke: () =>
      useCase.execute(
        {
          campusId: CAMPUS_ID,
          classId: CLASS_ID,
          studentId: STUDENT_ID,
          enrollmentDate: new Date("2024-09-01T00:00:00.000Z"),
        },
        buildActor(),
      ),
    entityWriteSpy: enrollmentRepository.save as jest.Mock,
    auditSpy,
    runSpy,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// UoW-based scenarios (EDIT / ARCHIVE / CREATE / LINK).
// All four use `UnitOfWorkPort.run` with a typed `TransactionContext` whose
// `recordAudit` is the audit-emit seam.
// ────────────────────────────────────────────────────────────────────────────
function buildEditScenario(): Scenario {
  const studentRepository = createMockStudentRepository();
  studentRepository.findById.mockResolvedValue(
    createStudent({
      id: STUDENT_ID,
      campusId: CAMPUS_ID,
      fullName: "Bob Tran",
      phoneNumber: "555-1111",
    }),
  );

  const updateStudentSpy = jest.fn().mockResolvedValue({ id: STUDENT_ID });
  const recordAuditSpy = jest.fn().mockRejectedValue(AUDIT_ERROR);
  const mockTx = {
    updateStudent: updateStudentSpy,
    recordAudit: recordAuditSpy,
  } as unknown as TransactionContext;

  const runSpy = jest.fn((task: (tx: TransactionContext) => Promise<unknown>) =>
    task(mockTx),
  );
  const unitOfWork = { run: runSpy } as unknown as UnitOfWorkPort;

  const useCase = new UpdateStudentUseCase(studentRepository, unitOfWork);

  return {
    // Phone number change → diff is non-empty → recordAudit will be called.
    invoke: () =>
      useCase.execute(STUDENT_ID, { phoneNumber: "555-2222" }, buildActor()),
    entityWriteSpy: updateStudentSpy,
    auditSpy: recordAuditSpy,
    runSpy,
  };
}

function buildArchiveScenario(): Scenario {
  const studentRepository = createMockStudentRepository();
  studentRepository.findById.mockResolvedValue(
    createStudent({ id: STUDENT_ID, campusId: CAMPUS_ID }),
  );

  const updateStudentSpy = jest.fn().mockResolvedValue({ id: STUDENT_ID });
  const recordAuditSpy = jest.fn().mockRejectedValue(AUDIT_ERROR);
  const mockTx = {
    updateStudent: updateStudentSpy,
    recordAudit: recordAuditSpy,
  } as unknown as TransactionContext;

  const runSpy = jest.fn((task: (tx: TransactionContext) => Promise<unknown>) =>
    task(mockTx),
  );
  const unitOfWork = { run: runSpy } as unknown as UnitOfWorkPort;

  const useCase = new ArchiveStudentUseCase(studentRepository, unitOfWork);

  return {
    invoke: () => useCase.execute(STUDENT_ID, CAMPUS_ID, buildActor()),
    entityWriteSpy: updateStudentSpy,
    auditSpy: recordAuditSpy,
    runSpy,
  };
}

function buildCreateScenario(): Scenario {
  const studentRepository = createMockStudentRepository();
  // No existing student with the same email/phone.
  studentRepository.findByEmailInCampus.mockResolvedValue(null);
  studentRepository.findByPhoneNumberInCampus.mockResolvedValue(null);

  const guardianRepository = createMockGuardianRepository();

  const createStudentSpy = jest.fn().mockResolvedValue({ id: STUDENT_ID });
  const recordAuditSpy = jest.fn().mockRejectedValue(AUDIT_ERROR);
  const mockTx = {
    createStudent: createStudentSpy,
    createUser: jest.fn(),
    assignGuardians: jest.fn(),
    recordAudit: recordAuditSpy,
  } as unknown as TransactionContext;

  const runSpy = jest.fn((task: (tx: TransactionContext) => Promise<unknown>) =>
    task(mockTx),
  );
  const unitOfWork = { run: runSpy } as unknown as UnitOfWorkPort;

  const identityPort = {
    provisionUser: jest.fn(),
    deleteIdentity: jest.fn(),
  } as unknown as IdentityPort;
  const codeGenerator = {
    generateNextCode: jest.fn().mockResolvedValue("STU-2026-000123"),
  } as unknown as StudentCodeGeneratorPort;

  const useCase = new CreateStudentUseCase(
    studentRepository,
    guardianRepository,
    unitOfWork,
    identityPort,
    codeGenerator,
  );

  return {
    // No Clerk user → no compensation path. UoW closure runs createStudent
    // then recordAudit, which throws.
    invoke: () =>
      useCase.execute(
        {
          campusId: CAMPUS_ID,
          fullName: "Eli Pham",
        },
        buildActor(),
      ),
    entityWriteSpy: createStudentSpy,
    auditSpy: recordAuditSpy,
    runSpy,
  };
}

function buildLinkScenario(): Scenario {
  const studentRepository = createMockStudentRepository();
  studentRepository.findById.mockResolvedValue(
    createStudent({
      id: STUDENT_ID,
      campusId: CAMPUS_ID,
      fullName: "Eli Pham",
    }),
  );
  studentRepository.getStudentGuardians.mockResolvedValue([]);

  const guardianRepository = createMockGuardianRepository();
  guardianRepository.findById.mockResolvedValue(
    createGuardian({
      id: GUARDIAN_ID,
      campusId: CAMPUS_ID,
      fullName: "Carol Pham",
    }),
  );

  const relationshipRepository = {
    findById: jest.fn().mockResolvedValue({
      id: REL_ID,
      name: "Mother",
      isArchived: false,
    }),
  } as unknown as jest.Mocked<GuardianRelationshipTypeRepository>;

  const assignGuardiansSpy = jest.fn().mockResolvedValue(undefined);
  const recordAuditSpy = jest.fn().mockRejectedValue(AUDIT_ERROR);
  const mockTx = {
    assignGuardians: assignGuardiansSpy,
    recordAudit: recordAuditSpy,
  } as unknown as TransactionContext;

  const runSpy = jest.fn((task: (tx: TransactionContext) => Promise<unknown>) =>
    task(mockTx),
  );
  const unitOfWork = { run: runSpy } as unknown as UnitOfWorkPort;

  const useCase = new LinkStudentWithGuardianUseCase(
    studentRepository,
    guardianRepository,
    relationshipRepository,
    unitOfWork,
  );

  return {
    invoke: () =>
      useCase.execute(
        {
          studentId: STUDENT_ID,
          guardianId: GUARDIAN_ID,
          relationshipId: REL_ID,
        },
        buildActor(),
      ),
    entityWriteSpy: assignGuardiansSpy,
    auditSpy: recordAuditSpy,
    runSpy,
  };
}

describe("Audit-write atomicity (admin-audit-log AC-4 / Scenario 2)", () => {
  describe.each([
    { group: "ENROLL", build: buildEnrollScenario },
    { group: "EDIT", build: buildEditScenario },
    { group: "ARCHIVE", build: buildArchiveScenario },
    { group: "CREATE", build: buildCreateScenario },
    { group: "LINK", build: buildLinkScenario },
  ])("$group group", ({ group, build }) => {
    it(`${group}: audit-write failure inside the tx propagates and the entity write runs in the same closure`, async () => {
      const scenario = build();

      await expect(scenario.invoke()).rejects.toThrow(AUDIT_ERROR.message);

      // The transaction wrapper was entered exactly once.
      expect(scenario.runSpy).toHaveBeenCalledTimes(1);
      // The entity write was issued (i.e. it lived inside the closure that
      // ultimately threw — a real DB would roll it back).
      expect(scenario.entityWriteSpy).toHaveBeenCalledTimes(1);
      // The audit emit was the failure point.
      expect(scenario.auditSpy).toHaveBeenCalledTimes(1);
    });
  });
});
