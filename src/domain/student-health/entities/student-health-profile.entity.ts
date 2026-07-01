import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";

import {
  StudentHealthAllergySeverity,
  StudentHealthConditionCategory,
  StudentHealthConditionStatus,
  StudentHealthRestrictionType,
} from "../enums";

export interface StudentHealthAllergy {
  name: string;
  severity: StudentHealthAllergySeverity;
  reaction: string | null;
  notes: string | null;
}

export interface StudentHealthCondition {
  category: StudentHealthConditionCategory;
  name: string;
  status: StudentHealthConditionStatus;
  notes: string | null;
}

export interface StudentHealthRestriction {
  type: StudentHealthRestrictionType;
  description: string;
  notes: string | null;
}

export interface StudentHealthProfileLastUpdatedBy {
  id: string;
  fullName: string | null;
}

export interface StudentHealthProfileProps {
  campusId: string;
  studentId: string;
  allergies: StudentHealthAllergy[];
  conditions: StudentHealthCondition[];
  restrictions: StudentHealthRestriction[];
  emergencyNotes: string | null;
  lastUpdatedByUserId: string | null;
  lastUpdatedBy: StudentHealthProfileLastUpdatedBy | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateStudentHealthProfileData = Optional<
  StudentHealthProfileProps,
  | "allergies"
  | "conditions"
  | "restrictions"
  | "emergencyNotes"
  | "lastUpdatedByUserId"
  | "lastUpdatedBy"
  | "createdAt"
  | "updatedAt"
>;

export interface UpdateStudentHealthProfileData {
  allergies?: unknown;
  conditions?: unknown;
  restrictions?: unknown;
  emergencyNotes?: unknown;
}

const PROFILE_UPDATE_FIELDS = [
  "allergies",
  "conditions",
  "restrictions",
  "emergencyNotes",
] as const;

export class StudentHealthProfile extends Entity<StudentHealthProfileProps> {
  get campusId(): string {
    return this.props.campusId;
  }

  get studentId(): string {
    return this.props.studentId;
  }

  get allergies(): StudentHealthAllergy[] {
    return this.props.allergies.map((allergy) => ({ ...allergy }));
  }

  get conditions(): StudentHealthCondition[] {
    return this.props.conditions.map((condition) => ({ ...condition }));
  }

  get restrictions(): StudentHealthRestriction[] {
    return this.props.restrictions.map((restriction) => ({ ...restriction }));
  }

  get emergencyNotes(): string | null {
    return this.props.emergencyNotes;
  }

  get lastUpdatedByUserId(): string | null {
    return this.props.lastUpdatedByUserId;
  }

  get lastUpdatedBy(): StudentHealthProfileLastUpdatedBy | null {
    return this.props.lastUpdatedBy ? { ...this.props.lastUpdatedBy } : null;
  }

  get lastUpdatedAt(): Date | null {
    return this.lastUpdatedByUserId ? this.props.updatedAt : null;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(data: UpdateStudentHealthProfileData, actorUserId: string): void {
    assertAllowedKeys(data, PROFILE_UPDATE_FIELDS, "Health profile");

    if (!actorUserId) {
      throw new Error("Actor user ID is required");
    }

    if (data.allergies !== undefined) {
      this.props.allergies = normalizeAllergies(data.allergies);
    }
    if (data.conditions !== undefined) {
      this.props.conditions = normalizeConditions(data.conditions);
    }
    if (data.restrictions !== undefined) {
      this.props.restrictions = normalizeRestrictions(data.restrictions);
    }
    if (data.emergencyNotes !== undefined) {
      this.props.emergencyNotes = normalizeOptionalText(data.emergencyNotes);
    }

    this.props.lastUpdatedByUserId = actorUserId;
    this.props.lastUpdatedBy = null;
    this.touch();
  }

  static create(
    props: CreateStudentHealthProfileData,
    id?: string,
  ): StudentHealthProfile {
    if (!props.campusId) {
      throw new Error("Campus ID is required for student health profile");
    }
    if (!props.studentId) {
      throw new Error("Student ID is required for student health profile");
    }

    return new StudentHealthProfile(
      {
        campusId: props.campusId,
        studentId: props.studentId,
        allergies: normalizeAllergies(props.allergies ?? []),
        conditions: normalizeConditions(props.conditions ?? []),
        restrictions: normalizeRestrictions(props.restrictions ?? []),
        emergencyNotes: normalizeOptionalText(props.emergencyNotes ?? null),
        lastUpdatedByUserId: props.lastUpdatedByUserId ?? null,
        lastUpdatedBy: props.lastUpdatedBy ?? null,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id ? new UniqueEntityID(id) : undefined,
    );
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}

export function normalizeAllergies(value: unknown): StudentHealthAllergy[] {
  const items = assertArray(value, "Allergies");
  return items.map((item, index) => {
    const object = assertObject(item, `Allergy ${index + 1}`);
    assertAllowedKeys(
      object,
      ["name", "severity", "reaction", "notes"],
      `Allergy ${index + 1}`,
    );

    return {
      name: normalizeRequiredText(object.name, `Allergy ${index + 1} name`),
      severity: normalizeEnum(
        object.severity,
        StudentHealthAllergySeverity,
        `Allergy ${index + 1} severity`,
      ),
      reaction: normalizeOptionalText(object.reaction),
      notes: normalizeOptionalText(object.notes),
    };
  });
}

export function normalizeConditions(value: unknown): StudentHealthCondition[] {
  const items = assertArray(value, "Conditions");
  return items.map((item, index) => {
    const object = assertObject(item, `Condition ${index + 1}`);
    assertAllowedKeys(
      object,
      ["category", "name", "status", "notes"],
      `Condition ${index + 1}`,
    );

    return {
      category: normalizeEnum(
        object.category,
        StudentHealthConditionCategory,
        `Condition ${index + 1} category`,
      ),
      name: normalizeRequiredText(object.name, `Condition ${index + 1} name`),
      status: normalizeEnum(
        object.status,
        StudentHealthConditionStatus,
        `Condition ${index + 1} status`,
      ),
      notes: normalizeOptionalText(object.notes),
    };
  });
}

export function normalizeRestrictions(
  value: unknown,
): StudentHealthRestriction[] {
  const items = assertArray(value, "Restrictions");
  return items.map((item, index) => {
    const object = assertObject(item, `Restriction ${index + 1}`);
    assertAllowedKeys(
      object,
      ["type", "description", "notes"],
      `Restriction ${index + 1}`,
    );

    return {
      type: normalizeEnum(
        object.type,
        StudentHealthRestrictionType,
        `Restriction ${index + 1} type`,
      ),
      description: normalizeRequiredText(
        object.description,
        `Restriction ${index + 1} description`,
      ),
      notes: normalizeOptionalText(object.notes),
    };
  });
}

function assertArray(value: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
  return value;
}

function assertObject(
  value: unknown,
  fieldName: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertAllowedKeys(
  value: object,
  allowedKeys: readonly string[],
  fieldName: string,
): void {
  const unknownKeys = Object.keys(value).filter(
    (key) => !allowedKeys.includes(key),
  );

  if (unknownKeys.length > 0) {
    throw new Error(
      `${fieldName} contains unknown field${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}`,
    );
  }
}

function normalizeRequiredText(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }

  return normalized;
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

function normalizeEnum<T extends Record<string, string>>(
  value: unknown,
  enumObject: T,
  fieldName: string,
): T[keyof T] {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required`);
  }

  const normalized = value.trim();
  const allowedValues = Object.values(enumObject);
  if (!allowedValues.includes(normalized)) {
    throw new Error(`${fieldName} must be one of: ${allowedValues.join(", ")}`);
  }

  return normalized as T[keyof T];
}
