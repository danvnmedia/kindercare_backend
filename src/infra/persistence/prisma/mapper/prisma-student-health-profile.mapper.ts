import {
  Prisma,
  StudentHealthProfile as PrismaStudentHealthProfile,
} from "@prisma/client";

import {
  StudentHealthAllergy,
  StudentHealthCondition,
  StudentHealthProfile,
  StudentHealthRestriction,
} from "@/domain/student-health";

type PrismaProfileUpdater = {
  id: string;
  staffs?: Array<{ fullName: string }>;
  guardians?: Array<{ fullName: string }>;
};

export type PrismaStudentHealthProfileWithRelations =
  PrismaStudentHealthProfile & {
    lastUpdatedBy?: PrismaProfileUpdater | null;
  };

export class PrismaStudentHealthProfileMapper {
  static include = {
    lastUpdatedBy: {
      include: {
        staffs: {
          select: { fullName: true },
          take: 1,
        },
        guardians: {
          select: { fullName: true },
          take: 1,
        },
      },
    },
  } as const;

  static toDomain(
    row: PrismaStudentHealthProfileWithRelations,
  ): StudentHealthProfile {
    return StudentHealthProfile.create(
      {
        campusId: row.campusId,
        studentId: row.studentId,
        allergies: row.allergies as unknown as StudentHealthAllergy[],
        conditions: row.conditions as unknown as StudentHealthCondition[],
        restrictions: row.restrictions as unknown as StudentHealthRestriction[],
        emergencyNotes: row.emergencyNotes,
        lastUpdatedByUserId: row.lastUpdatedByUserId,
        lastUpdatedBy: row.lastUpdatedBy
          ? {
              id: row.lastUpdatedBy.id,
              fullName: resolveUserProfileName(row.lastUpdatedBy),
            }
          : null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      row.id,
    );
  }

  static toPrismaCreate(
    profile: StudentHealthProfile,
  ): Prisma.StudentHealthProfileUncheckedCreateInput {
    return {
      id: profile.id,
      campusId: profile.campusId,
      studentId: profile.studentId,
      allergies: profile.allergies as unknown as Prisma.InputJsonValue,
      conditions: profile.conditions as unknown as Prisma.InputJsonValue,
      restrictions: profile.restrictions as unknown as Prisma.InputJsonValue,
      emergencyNotes: profile.emergencyNotes,
      lastUpdatedByUserId: profile.lastUpdatedByUserId,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  static toPrismaUpdate(
    profile: StudentHealthProfile,
  ): Prisma.StudentHealthProfileUncheckedUpdateInput {
    return {
      allergies: profile.allergies as unknown as Prisma.InputJsonValue,
      conditions: profile.conditions as unknown as Prisma.InputJsonValue,
      restrictions: profile.restrictions as unknown as Prisma.InputJsonValue,
      emergencyNotes: profile.emergencyNotes,
      lastUpdatedByUserId: profile.lastUpdatedByUserId,
      updatedAt: profile.updatedAt,
    };
  }
}

function resolveUserProfileName(user: PrismaProfileUpdater): string | null {
  return user.staffs?.[0]?.fullName ?? user.guardians?.[0]?.fullName ?? null;
}
