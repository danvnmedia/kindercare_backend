import {
  Prisma,
  StudentHealthCheckup as PrismaStudentHealthCheckup,
} from "@prisma/client";

import { StudentHealthCheckup } from "@/domain/student-health";

type PrismaCheckupUser = {
  id: string;
  staffs?: Array<{ fullName: string }>;
  guardians?: Array<{ fullName: string }>;
};

export type PrismaStudentHealthCheckupWithRelations =
  PrismaStudentHealthCheckup & {
    recordedBy?: PrismaCheckupUser | null;
    lastUpdatedBy?: PrismaCheckupUser | null;
  };

export class PrismaStudentHealthCheckupMapper {
  static include = {
    recordedBy: {
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
    row: PrismaStudentHealthCheckupWithRelations,
  ): StudentHealthCheckup {
    return StudentHealthCheckup.create(
      {
        campusId: row.campusId,
        studentId: row.studentId,
        checkupType: row.checkupType as StudentHealthCheckup["checkupType"],
        checkedAt: row.checkedAt,
        heightCm: row.heightCm?.toNumber() ?? null,
        weightKg: row.weightKg?.toNumber() ?? null,
        notes: row.notes,
        recordedByUserId: row.recordedByUserId,
        recordedBy: row.recordedBy
          ? {
              id: row.recordedBy.id,
              fullName: resolveUserProfileName(row.recordedBy),
            }
          : null,
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
    checkup: StudentHealthCheckup,
  ): Prisma.StudentHealthCheckupUncheckedCreateInput {
    return {
      id: checkup.id,
      campusId: checkup.campusId,
      studentId: checkup.studentId,
      checkupType: checkup.checkupType,
      checkedAt: checkup.checkedAt,
      heightCm: checkup.heightCm,
      weightKg: checkup.weightKg,
      notes: checkup.notes,
      recordedByUserId: checkup.recordedByUserId,
      lastUpdatedByUserId: checkup.lastUpdatedByUserId,
      createdAt: checkup.createdAt,
      updatedAt: checkup.updatedAt,
    };
  }

  static toPrismaUpdate(
    checkup: StudentHealthCheckup,
  ): Prisma.StudentHealthCheckupUncheckedUpdateInput {
    return {
      checkupType: checkup.checkupType,
      checkedAt: checkup.checkedAt,
      heightCm: checkup.heightCm,
      weightKg: checkup.weightKg,
      notes: checkup.notes,
      lastUpdatedByUserId: checkup.lastUpdatedByUserId,
      updatedAt: checkup.updatedAt,
    };
  }
}

function resolveUserProfileName(user: PrismaCheckupUser): string | null {
  return user.staffs?.[0]?.fullName ?? user.guardians?.[0]?.fullName ?? null;
}
