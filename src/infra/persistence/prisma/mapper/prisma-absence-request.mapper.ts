import {
  AbsenceRequest as PrismaAbsenceRequest,
  Guardian as PrismaGuardian,
  Prisma,
  Student as PrismaStudent,
  User as PrismaUser,
} from "@prisma/client";

import {
  AbsenceRequest,
  AbsenceRequestStatus,
  AbsenceRequestType,
} from "@/domain/absence-request";

type PrismaAbsenceRequestWithRelations = PrismaAbsenceRequest & {
  student?: PrismaStudent | null;
  requesterGuardian?: PrismaGuardian | null;
  reviewedBy?: PrismaUser | null;
};

export class PrismaAbsenceRequestMapper {
  static include = {
    student: true,
    requesterGuardian: true,
    reviewedBy: true,
  } satisfies Prisma.AbsenceRequestInclude;

  static toDomain(row: PrismaAbsenceRequestWithRelations): AbsenceRequest {
    return AbsenceRequest.create(
      {
        campusId: row.campusId,
        studentId: row.studentId,
        requesterGuardianId: row.requesterGuardianId,
        requesterUserId: row.requesterUserId,
        absenceType: row.absenceType as AbsenceRequestType,
        startDate: row.startDate,
        endDate: row.endDate,
        startMinute: row.startMinute,
        endMinute: row.endMinute,
        description: row.description,
        status: row.status as AbsenceRequestStatus,
        reviewedById: row.reviewedById,
        reviewedAt: row.reviewedAt,
        reviewNote: row.reviewNote,
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
        reviewedBy: row.reviewedBy
          ? {
              id: row.reviewedBy.id,
              name: row.reviewedBy.clerkUid,
              email: null,
            }
          : null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      row.id,
    );
  }

  static toPrisma(
    absenceRequest: AbsenceRequest,
  ): Prisma.AbsenceRequestUncheckedCreateInput {
    return {
      id: absenceRequest.id.toString(),
      campusId: absenceRequest.campusId,
      studentId: absenceRequest.studentId,
      requesterGuardianId: absenceRequest.requesterGuardianId,
      requesterUserId: absenceRequest.requesterUserId,
      absenceType: absenceRequest.absenceType,
      startDate: absenceRequest.startDate,
      endDate: absenceRequest.endDate,
      startMinute: absenceRequest.startMinute,
      endMinute: absenceRequest.endMinute,
      description: absenceRequest.description,
      status: absenceRequest.status,
      reviewedById: absenceRequest.reviewedById,
      reviewedAt: absenceRequest.reviewedAt,
      reviewNote: absenceRequest.reviewNote,
      createdAt: absenceRequest.createdAt,
      updatedAt: absenceRequest.updatedAt,
    };
  }

  static toPrismaUpdate(
    absenceRequest: AbsenceRequest,
  ): Prisma.AbsenceRequestUncheckedUpdateInput {
    return {
      campusId: absenceRequest.campusId,
      studentId: absenceRequest.studentId,
      requesterGuardianId: absenceRequest.requesterGuardianId,
      requesterUserId: absenceRequest.requesterUserId,
      absenceType: absenceRequest.absenceType,
      startDate: absenceRequest.startDate,
      endDate: absenceRequest.endDate,
      startMinute: absenceRequest.startMinute,
      endMinute: absenceRequest.endMinute,
      description: absenceRequest.description,
      status: absenceRequest.status,
      reviewedById: absenceRequest.reviewedById,
      reviewedAt: absenceRequest.reviewedAt,
      reviewNote: absenceRequest.reviewNote,
      updatedAt: absenceRequest.updatedAt,
    };
  }
}
