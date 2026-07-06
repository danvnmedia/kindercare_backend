import { BadRequestException, NotFoundException } from "@nestjs/common";

import { AuditEventRecorderPort } from "@/application/audit";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { StudentHealthProfileRepository } from "@/application/student-health";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import {
  StudentHealthAllergySeverity,
  StudentHealthConditionCategory,
  StudentHealthConditionStatus,
  StudentHealthProfile,
  StudentHealthRestrictionType,
} from "@/domain/student-health";
import { Student } from "@/domain/user-management/entities/student.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { User } from "@/domain/user-management/user.entity";

import { GetStudentHealthProfileUseCase } from "./get-student-health-profile.use-case";
import { UpdateStudentHealthProfileUseCase } from "./update-student-health-profile.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const OTHER_CAMPUS_ID = "22222222-2222-4222-a222-222222222222";
const STUDENT_ID = "33333333-3333-4333-a333-333333333333";
const PROFILE_ID = "44444444-4444-4444-a444-444444444444";
const ACTOR_ID = "55555555-5555-4555-a555-555555555555";

const CURRENT_USER = {
  id: ACTOR_ID,
  profile: { fullName: "School Nurse" },
} as User;

function makeStudent(
  overrides: Partial<{ campusId: string; isArchived: boolean }> = {},
) {
  return Student.create(
    {
      campusId: overrides.campusId ?? CAMPUS_ID,
      studentCode: "STU-001",
      fullName: "Alice Student",
      email: null,
      phoneNumber: null,
      address: null,
      dateOfBirth: null,
      nickname: null,
      gender: Gender.FEMALE,
      isArchived: overrides.isArchived ?? false,
    },
    STUDENT_ID,
  );
}

function makeProfile() {
  return StudentHealthProfile.create(
    {
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
      allergies: [],
      conditions: [],
      restrictions: [],
      emergencyNotes: null,
      lastUpdatedByUserId: null,
    },
    PROFILE_ID,
  );
}

describe("Student health profile use cases", () => {
  let profileRepository: jest.Mocked<StudentHealthProfileRepository>;
  let studentRepository: jest.Mocked<StudentRepository>;
  let transactionRunner: jest.Mocked<TransactionRunnerPort>;
  let auditRecorder: jest.Mocked<AuditEventRecorderPort>;

  beforeEach(() => {
    profileRepository = {
      findByStudentInCampus: jest.fn(),
      getOrCreateEmpty: jest.fn(),
      update: jest.fn(async (profile) => profile),
    } as unknown as jest.Mocked<StudentHealthProfileRepository>;
    studentRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<StudentRepository>;
    transactionRunner = {
      run: jest.fn(async (task) => task({} as never)),
    } as unknown as jest.Mocked<TransactionRunnerPort>;
    auditRecorder = {
      record: jest.fn(async () => undefined),
    } as unknown as jest.Mocked<AuditEventRecorderPort>;
  });

  it("GET returns a stable empty profile when no profile exists", async () => {
    const profile = makeProfile();
    studentRepository.findById.mockResolvedValue(makeStudent());
    profileRepository.getOrCreateEmpty.mockResolvedValue(profile);

    const useCase = new GetStudentHealthProfileUseCase(
      profileRepository,
      studentRepository,
    );

    const result = await useCase.execute({
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
    });

    expect(profileRepository.getOrCreateEmpty).toHaveBeenCalledWith(
      CAMPUS_ID,
      STUDENT_ID,
    );
    expect(result.allergies).toEqual([]);
    expect(result.conditions).toEqual([]);
    expect(result.restrictions).toEqual([]);
    expect(result.emergencyNotes).toBeNull();
    expect(result.lastUpdatedAt).toBeNull();
  });

  it("PATCH validates, trims, updates, and audits structured profile fields", async () => {
    const profile = makeProfile();
    studentRepository.findById.mockResolvedValue(makeStudent());
    profileRepository.getOrCreateEmpty.mockResolvedValue(profile);

    const useCase = new UpdateStudentHealthProfileUseCase(
      profileRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    const result = await useCase.execute(
      CAMPUS_ID,
      STUDENT_ID,
      {
        allergies: [
          {
            name: "  Peanuts  ",
            severity: StudentHealthAllergySeverity.SEVERE,
            reaction: "  Rash  ",
            notes: "  Avoid peanut snacks.  ",
          },
        ],
        conditions: [
          {
            category: StudentHealthConditionCategory.EYE,
            name: "  Near-sightedness  ",
            status: StudentHealthConditionStatus.MONITORING,
            notes: "  Wears glasses.  ",
          },
        ],
        restrictions: [
          {
            type: StudentHealthRestrictionType.FOOD,
            description: "  No tree nuts  ",
            notes: null,
          },
        ],
        emergencyNotes: "  Carry inhaler.  ",
      },
      CURRENT_USER,
    );

    expect(result.allergies).toEqual([
      {
        name: "Peanuts",
        severity: StudentHealthAllergySeverity.SEVERE,
        reaction: "Rash",
        notes: "Avoid peanut snacks.",
      },
    ]);
    expect(result.conditions[0]).toMatchObject({
      category: StudentHealthConditionCategory.EYE,
      name: "Near-sightedness",
      status: StudentHealthConditionStatus.MONITORING,
      notes: "Wears glasses.",
    });
    expect(result.restrictions[0]).toEqual({
      type: StudentHealthRestrictionType.FOOD,
      description: "No tree nuts",
      notes: null,
    });
    expect(result.emergencyNotes).toBe("Carry inhaler.");
    expect(result.lastUpdatedByUserId).toBe(ACTOR_ID);
    expect(profileRepository.getOrCreateEmpty).toHaveBeenCalledWith(
      CAMPUS_ID,
      STUDENT_ID,
      {},
    );
    expect(profileRepository.update).toHaveBeenCalledWith(profile, {});
    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ACTOR_ID,
        action: "UPDATE_STUDENT_HEALTH_PROFILE",
        targetType: "student_health_profile",
        targetId: PROFILE_ID,
        campusId: CAMPUS_ID,
        context: {
          actorName: "School Nurse",
          studentId: STUDENT_ID,
        },
      }),
      {},
    );
  });

  it("PATCH rejects an empty payload before loading student/profile data", async () => {
    const useCase = new UpdateStudentHealthProfileUseCase(
      profileRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    await expect(
      useCase.execute(CAMPUS_ID, STUDENT_ID, {}, CURRENT_USER),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(studentRepository.findById).not.toHaveBeenCalled();
    expect(profileRepository.getOrCreateEmpty).not.toHaveBeenCalled();
  });

  it("PATCH rejects unknown top-level fields", async () => {
    const useCase = new UpdateStudentHealthProfileUseCase(
      profileRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        { unknown: true } as never,
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(studentRepository.findById).not.toHaveBeenCalled();
  });

  it("PATCH rejects invalid nested item values", async () => {
    studentRepository.findById.mockResolvedValue(makeStudent());
    profileRepository.getOrCreateEmpty.mockResolvedValue(makeProfile());

    const useCase = new UpdateStudentHealthProfileUseCase(
      profileRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        {
          allergies: [
            {
              name: " ",
              severity: StudentHealthAllergySeverity.SEVERE,
            },
          ],
        },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(profileRepository.getOrCreateEmpty).not.toHaveBeenCalled();
    expect(profileRepository.update).not.toHaveBeenCalled();
  });

  it("rejects cross-campus student access", async () => {
    studentRepository.findById.mockResolvedValue(
      makeStudent({ campusId: OTHER_CAMPUS_ID }),
    );

    const useCase = new GetStudentHealthProfileUseCase(
      profileRepository,
      studentRepository,
    );

    await expect(
      useCase.execute({ campusId: CAMPUS_ID, studentId: STUDENT_ID }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(profileRepository.getOrCreateEmpty).not.toHaveBeenCalled();
  });

  it("rejects archived-student writes", async () => {
    studentRepository.findById.mockResolvedValue(
      makeStudent({ isArchived: true }),
    );

    const useCase = new UpdateStudentHealthProfileUseCase(
      profileRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        { emergencyNotes: "Updated" },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(profileRepository.getOrCreateEmpty).not.toHaveBeenCalled();
    expect(auditRecorder.record).not.toHaveBeenCalled();
  });
});
