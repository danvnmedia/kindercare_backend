import {
  Prisma,
  StudentHealthInstruction as PrismaStudentHealthInstruction,
} from "@prisma/client";

import { StudentHealthInstruction } from "@/domain/student-health";

type PrismaInstructionUser = {
  id: string;
  staffs?: Array<{ fullName: string }>;
  guardians?: Array<{ fullName: string }>;
};

export type PrismaStudentHealthInstructionWithRelations =
  PrismaStudentHealthInstruction & {
    createdBy?: PrismaInstructionUser | null;
    lastUpdatedBy?: PrismaInstructionUser | null;
  };

export class PrismaStudentHealthInstructionMapper {
  static include = {
    createdBy: {
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
    row: PrismaStudentHealthInstructionWithRelations,
  ): StudentHealthInstruction {
    return StudentHealthInstruction.create(
      {
        campusId: row.campusId,
        studentId: row.studentId,
        instructionType:
          row.instructionType as StudentHealthInstruction["instructionType"],
        title: row.title,
        instruction: row.instruction,
        dosage: row.dosage,
        startDate: row.startDate,
        endDate: row.endDate,
        timesOfDay: row.timesOfDay,
        scheduleNotes: row.scheduleNotes,
        notes: row.notes,
        isActive: row.isActive,
        createdByUserId: row.createdByUserId,
        createdBy: row.createdBy
          ? {
              id: row.createdBy.id,
              fullName: resolveUserProfileName(row.createdBy),
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
    instruction: StudentHealthInstruction,
  ): Prisma.StudentHealthInstructionUncheckedCreateInput {
    return {
      id: instruction.id,
      campusId: instruction.campusId,
      studentId: instruction.studentId,
      instructionType: instruction.instructionType,
      title: instruction.title,
      instruction: instruction.instruction,
      dosage: instruction.dosage,
      startDate: instruction.startDate,
      endDate: instruction.endDate,
      timesOfDay: instruction.timesOfDay,
      scheduleNotes: instruction.scheduleNotes,
      notes: instruction.notes,
      isActive: instruction.isActive,
      createdByUserId: instruction.createdByUserId,
      lastUpdatedByUserId: instruction.lastUpdatedByUserId,
      createdAt: instruction.createdAt,
      updatedAt: instruction.updatedAt,
    };
  }

  static toPrismaUpdate(
    instruction: StudentHealthInstruction,
  ): Prisma.StudentHealthInstructionUncheckedUpdateInput {
    return {
      instructionType: instruction.instructionType,
      title: instruction.title,
      instruction: instruction.instruction,
      dosage: instruction.dosage,
      startDate: instruction.startDate,
      endDate: instruction.endDate,
      timesOfDay: instruction.timesOfDay,
      scheduleNotes: instruction.scheduleNotes,
      notes: instruction.notes,
      isActive: instruction.isActive,
      lastUpdatedByUserId: instruction.lastUpdatedByUserId,
      updatedAt: instruction.updatedAt,
    };
  }
}

function resolveUserProfileName(user: PrismaInstructionUser): string | null {
  return user.staffs?.[0]?.fullName ?? user.guardians?.[0]?.fullName ?? null;
}
