import {
  Prisma,
  StudentHealthEvent as PrismaStudentHealthEvent,
} from "@prisma/client";

import { StudentHealthEvent } from "@/domain/student-health";

type PrismaEventUser = {
  id: string;
  staffs?: Array<{ fullName: string }>;
  guardians?: Array<{ fullName: string }>;
};

export type PrismaStudentHealthEventWithRelations = PrismaStudentHealthEvent & {
  recordedBy?: PrismaEventUser | null;
  lastUpdatedBy?: PrismaEventUser | null;
};

export class PrismaStudentHealthEventMapper {
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
    row: PrismaStudentHealthEventWithRelations,
  ): StudentHealthEvent {
    return StudentHealthEvent.create(
      {
        campusId: row.campusId,
        studentId: row.studentId,
        eventType: row.eventType as StudentHealthEvent["eventType"],
        category: row.category as StudentHealthEvent["category"],
        title: row.title,
        description: row.description,
        occurredAt: row.occurredAt,
        status: row.status as StudentHealthEvent["status"],
        resolutionNotes: row.resolutionNotes,
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
    event: StudentHealthEvent,
  ): Prisma.StudentHealthEventUncheckedCreateInput {
    return {
      id: event.id,
      campusId: event.campusId,
      studentId: event.studentId,
      eventType: event.eventType,
      category: event.category,
      title: event.title,
      description: event.description,
      occurredAt: event.occurredAt,
      status: event.status,
      resolutionNotes: event.resolutionNotes,
      recordedByUserId: event.recordedByUserId,
      lastUpdatedByUserId: event.lastUpdatedByUserId,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  static toPrismaUpdate(
    event: StudentHealthEvent,
  ): Prisma.StudentHealthEventUncheckedUpdateInput {
    return {
      eventType: event.eventType,
      category: event.category,
      title: event.title,
      description: event.description,
      occurredAt: event.occurredAt,
      status: event.status,
      resolutionNotes: event.resolutionNotes,
      lastUpdatedByUserId: event.lastUpdatedByUserId,
      updatedAt: event.updatedAt,
    };
  }
}

function resolveUserProfileName(user: PrismaEventUser): string | null {
  return user.staffs?.[0]?.fullName ?? user.guardians?.[0]?.fullName ?? null;
}
