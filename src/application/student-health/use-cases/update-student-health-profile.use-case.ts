import { AuditEventRecorderPort, computeDiff } from "@/application/audit";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import {
  normalizeAllergies,
  normalizeConditions,
  normalizeRestrictions,
  StudentHealthProfile,
  UpdateStudentHealthProfileData,
} from "@/domain/student-health";
import { User } from "@/domain/user-management/user.entity";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { StudentHealthProfileRepository } from "../ports";
import {
  assertStudentWritable,
  getStudentInCampusOrThrow,
} from "./student-health-student-scope";

export type UpdateStudentHealthProfileInput = UpdateStudentHealthProfileData;

const UPDATABLE_FIELDS = [
  "allergies",
  "conditions",
  "restrictions",
  "emergencyNotes",
] as const;

@Injectable()
export class UpdateStudentHealthProfileUseCase {
  constructor(
    @Inject("STUDENT_HEALTH_PROFILE_REPOSITORY")
    private readonly profileRepository: StudentHealthProfileRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditRecorder: AuditEventRecorderPort,
  ) {}

  async execute(
    campusId: string,
    studentId: string,
    input: UpdateStudentHealthProfileInput,
    currentUser: User,
  ): Promise<StudentHealthProfile> {
    const normalizedInput = normalizeProfilePatchPayload(input);

    const student = await getStudentInCampusOrThrow(
      this.studentRepository,
      campusId,
      studentId,
    );
    assertStudentWritable(student);

    return this.transactionRunner.run(async (tx) => {
      const profile = await this.profileRepository.getOrCreateEmpty(
        campusId,
        studentId,
        tx,
      );
      const beforeAudit = pickStudentHealthProfileAuditFields(profile);

      profile.update(normalizedInput, currentUser.id);

      const requestedAfterAudit = pickStudentHealthProfileAuditFields(profile);
      const diff = computeDiff(beforeAudit, requestedAfterAudit);
      const saved = await this.profileRepository.update(profile, tx);

      await this.auditRecorder.record(
        {
          actorId: currentUser.id,
          action: "UPDATE_STUDENT_HEALTH_PROFILE",
          targetType: "student_health_profile",
          targetId: saved.id,
          campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            studentId,
          },
          beforeValue: diff.before,
          afterValue: diff.after,
        },
        tx,
      );

      return saved;
    });
  }
}

function assertPatchPayload(
  input: UpdateStudentHealthProfileInput,
): asserts input is UpdateStudentHealthProfileInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new BadRequestException("Health profile patch payload is required");
  }

  const keys = Object.keys(input);
  const unknownKeys = keys.filter(
    (key) =>
      !UPDATABLE_FIELDS.includes(key as (typeof UPDATABLE_FIELDS)[number]),
  );
  if (unknownKeys.length > 0) {
    throw new BadRequestException(
      `Unknown health profile field${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}`,
    );
  }

  const hasUpdate = UPDATABLE_FIELDS.some(
    (field) =>
      Object.prototype.hasOwnProperty.call(input, field) &&
      input[field] !== undefined,
  );

  if (!hasUpdate) {
    throw new BadRequestException(
      "At least one health profile field must be provided",
    );
  }
}

function normalizeProfilePatchPayload(
  input: UpdateStudentHealthProfileInput,
): UpdateStudentHealthProfileInput {
  assertPatchPayload(input);

  try {
    return {
      ...(input.allergies !== undefined
        ? { allergies: normalizeAllergies(input.allergies) }
        : {}),
      ...(input.conditions !== undefined
        ? { conditions: normalizeConditions(input.conditions) }
        : {}),
      ...(input.restrictions !== undefined
        ? { restrictions: normalizeRestrictions(input.restrictions) }
        : {}),
      ...(input.emergencyNotes !== undefined
        ? { emergencyNotes: normalizeOptionalText(input.emergencyNotes) }
        : {}),
    };
  } catch (error) {
    throw new BadRequestException((error as Error).message);
  }
}

function normalizeOptionalText(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("Optional text fields must be strings or null");
  }

  const normalized = value.trim();
  return normalized || null;
}

function pickStudentHealthProfileAuditFields(profile: StudentHealthProfile) {
  return {
    allergies: profile.allergies,
    conditions: profile.conditions,
    restrictions: profile.restrictions,
    emergencyNotes: profile.emergencyNotes,
  };
}
