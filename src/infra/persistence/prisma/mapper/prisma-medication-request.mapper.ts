import {
  Guardian as PrismaGuardian,
  MedicationAdministrationLog as PrismaMedicationAdministrationLog,
  MedicationAdministrationOccurrence as PrismaMedicationAdministrationOccurrence,
  MedicationRequest as PrismaMedicationRequest,
  MedicationRequestItem as PrismaMedicationRequestItem,
  MedicationRequestTimelineEntry as PrismaMedicationRequestTimelineEntry,
  Prisma,
  Staff as PrismaStaff,
  Student as PrismaStudent,
  User as PrismaUser,
} from "@prisma/client";

import {
  MedicationAdministrationLog,
  MedicationAdministrationOutcome,
  MedicationAdministrationOccurrence,
  MedicationRequest,
  MedicationRequestStatus,
  MedicationRequestTimelineAction,
  MedicationRequestTimelineActorType,
  MedicationRequestTimelineEntry,
  MedicationUserSummary,
} from "@/domain/medication";

const medicationUserSummaryInclude = {
  include: {
    staffs: {
      select: {
        campusId: true,
        fullName: true,
        email: true,
      },
    },
    guardians: {
      select: {
        campusId: true,
        fullName: true,
        email: true,
      },
    },
  },
} satisfies Prisma.UserDefaultArgs;

type PrismaMedicationUserProfile = Pick<
  PrismaStaff | PrismaGuardian,
  "campusId" | "fullName" | "email"
>;

type PrismaMedicationUserSummaryWithProfiles = PrismaUser & {
  staffs?: PrismaMedicationUserProfile[];
  guardians?: PrismaMedicationUserProfile[];
};

export type PrismaMedicationRequestWithRelations = PrismaMedicationRequest & {
  items?: PrismaMedicationRequestItem[];
  student?: PrismaStudent | null;
  requesterGuardian?: PrismaGuardian | null;
  reviewedByUser?: PrismaMedicationUserSummaryWithProfiles | null;
  timelineEntries?: PrismaMedicationRequestTimelineEntry[];
  occurrences?: PrismaMedicationAdministrationOccurrenceWithRelations[];
};

type PrismaMedicationAdministrationLogWithRelations =
  PrismaMedicationAdministrationLog & {
    recordedBy?: PrismaMedicationUserSummaryWithProfiles | null;
  };

type PrismaMedicationAdministrationOccurrenceWithRelations =
  PrismaMedicationAdministrationOccurrence & {
    logs?: PrismaMedicationAdministrationLogWithRelations[];
  };

export class PrismaMedicationRequestMapper {
  static include = {
    items: {
      orderBy: { createdAt: "asc" },
    },
    student: true,
    requesterGuardian: true,
    reviewedByUser: true,
    timelineEntries: {
      orderBy: { createdAt: "asc" },
    },
  } satisfies Prisma.MedicationRequestInclude;

  static detailInclude = {
    ...PrismaMedicationRequestMapper.include,
    reviewedByUser: medicationUserSummaryInclude,
    occurrences: {
      include: {
        logs: {
          include: {
            recordedBy: medicationUserSummaryInclude,
          },
          orderBy: [{ recordedAt: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ dueDate: "asc" }, { dueMinute: "asc" }],
    },
  } satisfies Prisma.MedicationRequestInclude;

  static lifecycleInclude = {
    items: {
      orderBy: { createdAt: "asc" },
    },
    occurrences: {
      orderBy: [{ dueDate: "asc" }, { dueMinute: "asc" }],
    },
  } satisfies Prisma.MedicationRequestInclude;

  static toDomain(
    row: PrismaMedicationRequestWithRelations,
  ): MedicationRequest {
    return MedicationRequest.create(
      {
        campusId: row.campusId,
        studentId: row.studentId,
        requesterGuardianId: row.requesterGuardianId,
        requesterUserId: row.requesterUserId,
        status: row.status as MedicationRequestStatus,
        startDate: row.startDate,
        endDate: row.endDate,
        reason: row.reason,
        parentNotes: row.parentNotes,
        reviewedByUserId: row.reviewedByUserId,
        reviewedAt: row.reviewedAt,
        reviewNote: row.reviewNote,
        cancelledAt: row.cancelledAt,
        cancelReason: row.cancelReason,
        completedAt: row.completedAt,
        expiredAt: row.expiredAt,
        items: (row.items ?? []).map((item) => ({
          id: item.id,
          medicationName: item.medicationName,
          dosage: item.dosage,
          instructions: item.instructions,
          timesOfDay: item.timesOfDay,
          scheduleNotes: item.scheduleNotes,
          notes: item.notes,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
        student: row.student
          ? {
              id: row.student.id,
              fullName: row.student.fullName,
              studentCode: row.student.studentCode,
            }
          : null,
        requesterGuardian: row.requesterGuardian
          ? {
              id: row.requesterGuardian.id,
              fullName: row.requesterGuardian.fullName,
              email: row.requesterGuardian.email,
              phoneNumber: row.requesterGuardian.phoneNumber,
            }
          : null,
        reviewedByUser: row.reviewedByUser
          ? toMedicationUserSummary(row.reviewedByUser, row.campusId)
          : null,
        timelineEntries: (row.timelineEntries ?? []).map((entry) =>
          MedicationRequestTimelineEntry.create(
            {
              requestId: entry.requestId,
              campusId: entry.campusId,
              actorType: entry.actorType as MedicationRequestTimelineActorType,
              actorUserId: entry.actorUserId,
              actorGuardianId: entry.actorGuardianId,
              action: entry.action as MedicationRequestTimelineAction,
              note: entry.note,
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt,
            },
            entry.id,
          ),
        ),
        occurrences: (row.occurrences ?? []).map((occurrence) =>
          PrismaMedicationRequestMapper.toOccurrenceDomain(occurrence),
        ),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      row.id,
    );
  }

  static toPrismaCreate(
    request: MedicationRequest,
  ): Prisma.MedicationRequestUncheckedCreateInput {
    return {
      id: request.id,
      campusId: request.campusId,
      studentId: request.studentId,
      requesterGuardianId: request.requesterGuardianId,
      requesterUserId: request.requesterUserId,
      status: request.status,
      startDate: request.startDate,
      endDate: request.endDate,
      reason: request.reason,
      parentNotes: request.parentNotes,
      reviewedByUserId: request.reviewedByUserId,
      reviewedAt: request.reviewedAt,
      reviewNote: request.reviewNote,
      cancelledAt: request.cancelledAt,
      cancelReason: request.cancelReason,
      completedAt: request.completedAt,
      expiredAt: request.expiredAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      items: {
        create: request.items.map((item) => ({
          id: item.id,
          medicationName: item.medicationName,
          dosage: item.dosage,
          instructions: item.instructions,
          timesOfDay: item.timesOfDay,
          scheduleNotes: item.scheduleNotes,
          notes: item.notes,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      },
    };
  }

  static toPrismaUpdate(
    request: MedicationRequest,
  ): Prisma.MedicationRequestUncheckedUpdateInput {
    return {
      status: request.status,
      startDate: request.startDate,
      endDate: request.endDate,
      reason: request.reason,
      parentNotes: request.parentNotes,
      reviewedByUserId: request.reviewedByUserId,
      reviewedAt: request.reviewedAt,
      reviewNote: request.reviewNote,
      cancelledAt: request.cancelledAt,
      cancelReason: request.cancelReason,
      completedAt: request.completedAt,
      expiredAt: request.expiredAt,
      updatedAt: request.updatedAt,
    };
  }

  static toPrismaUpdateMany(
    request: MedicationRequest,
  ): Prisma.MedicationRequestUncheckedUpdateManyInput {
    return {
      status: request.status,
      startDate: request.startDate,
      endDate: request.endDate,
      reason: request.reason,
      parentNotes: request.parentNotes,
      reviewedByUserId: request.reviewedByUserId,
      reviewedAt: request.reviewedAt,
      reviewNote: request.reviewNote,
      cancelledAt: request.cancelledAt,
      cancelReason: request.cancelReason,
      completedAt: request.completedAt,
      expiredAt: request.expiredAt,
      updatedAt: request.updatedAt,
    };
  }

  static toPrismaTimelineCreate(
    entry: MedicationRequestTimelineEntry,
  ): Prisma.MedicationRequestTimelineEntryUncheckedCreateInput {
    return {
      id: entry.id,
      requestId: entry.requestId,
      campusId: entry.campusId,
      actorType: entry.actorType,
      actorUserId: entry.actorUserId,
      actorGuardianId: entry.actorGuardianId,
      action: entry.action,
      note: entry.note,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  static toPrismaOccurrenceCreate(
    occurrence: MedicationAdministrationOccurrence,
  ): Prisma.MedicationAdministrationOccurrenceCreateManyInput {
    return {
      id: occurrence.id,
      requestId: occurrence.requestId,
      medicationItemId: occurrence.medicationItemId,
      campusId: occurrence.campusId,
      studentId: occurrence.studentId,
      dueDate: occurrence.dueDate,
      dueMinute: occurrence.dueMinute,
      latestOutcome: occurrence.latestOutcome,
      latestLogId: occurrence.latestLogId,
      latestRecordedAt: occurrence.latestRecordedAt,
      latestRecordedByUserId: occurrence.latestRecordedByUserId,
      latestNote: occurrence.latestNote,
      createdAt: occurrence.createdAt,
      updatedAt: occurrence.updatedAt,
    };
  }

  private static toOccurrenceDomain(
    row: PrismaMedicationAdministrationOccurrenceWithRelations,
  ): MedicationAdministrationOccurrence {
    return MedicationAdministrationOccurrence.create(
      {
        requestId: row.requestId,
        medicationItemId: row.medicationItemId,
        campusId: row.campusId,
        studentId: row.studentId,
        dueDate: row.dueDate,
        dueMinute: row.dueMinute,
        latestOutcome: row.latestOutcome as MedicationAdministrationOutcome,
        latestLogId: row.latestLogId,
        latestRecordedAt: row.latestRecordedAt,
        latestRecordedByUserId: row.latestRecordedByUserId,
        latestNote: row.latestNote,
        logs: (row.logs ?? []).map((log) =>
          PrismaMedicationRequestMapper.toLogDomain(log, row.campusId),
        ),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      row.id,
    );
  }

  private static toLogDomain(
    row: PrismaMedicationAdministrationLogWithRelations,
    campusId: string,
  ): MedicationAdministrationLog {
    return MedicationAdministrationLog.create(
      {
        occurrenceId: row.occurrenceId,
        outcome: row.outcome as MedicationAdministrationOutcome,
        recordedByUserId: row.recordedByUserId,
        recordedAt: row.recordedAt,
        actualMinute: row.actualMinute,
        note: row.note,
        correctionOfLogId: row.correctionOfLogId,
        recordedByUser: row.recordedBy
          ? toMedicationUserSummary(row.recordedBy, campusId)
          : null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      row.id,
    );
  }
}

function toMedicationUserSummary(
  user: PrismaMedicationUserSummaryWithProfiles,
  campusId: string,
): MedicationUserSummary {
  const profile =
    findCampusProfile(user.staffs, campusId) ??
    findCampusProfile(user.guardians, campusId);

  return {
    id: user.id,
    name: profile?.fullName ?? user.clerkUid,
    email: profile?.email ?? null,
  };
}

function findCampusProfile(
  profiles: PrismaMedicationUserProfile[] | undefined,
  campusId: string,
): PrismaMedicationUserProfile | undefined {
  return profiles?.find((profile) => profile.campusId === campusId);
}
