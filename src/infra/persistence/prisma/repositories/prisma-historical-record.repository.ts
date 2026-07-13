import { Injectable } from "@nestjs/common";
import {
  HistoricalRecordType as PrismaHistoricalRecordType,
  Prisma,
} from "@prisma/client";
import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import {
  HistoricalRecordCorrectionEvent,
  HistoricalRecordRepository,
  HistoricalRecordWriteState,
  HistoricalRetentionPolicy,
} from "@/application/class-management/ports/historical-record.repository";
import {
  HistoricalCorrectionPatch,
  HistoricalRecordType,
} from "@/application/class-management/historical-record-view";
import { StudentHardDeleteGuardPort } from "@/application/user-management/ports/student-hard-delete-guard.port";
import { PrismaEnrollmentMapper } from "../mapper/prisma-enrollment.mapper";
import { PrismaSchoolYearEnrollmentMapper } from "../mapper/prisma-school-year-enrollment.mapper";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaHistoricalRecordRepository
  implements HistoricalRecordRepository, StudentHardDeleteGuardPort
{
  constructor(private readonly prisma: PrismaService) {}

  async findEnrollmentByIdInCampus(id: string, campusId: string) {
    const row = await this.prisma.enrollment.findFirst({
      where: { id, class: { campusId } },
      include: {
        class: { include: { schoolYear: true, gradeLevel: true } },
        student: true,
      },
    });
    return row ? PrismaEnrollmentMapper.toDomain(row) : null;
  }

  async findSchoolYearEnrollmentByIdInCampus(id: string, campusId: string) {
    const row = await this.prisma.schoolYearEnrollment.findFirst({
      where: { id, campusId },
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
      },
    });
    return row ? PrismaSchoolYearEnrollmentMapper.toDomain(row) : null;
  }

  async findCorrections(
    recordType: HistoricalRecordType,
    recordId: string,
  ): Promise<HistoricalRecordCorrectionEvent[]> {
    const rows = await this.prisma.historicalRecordCorrectionEvent.findMany({
      where: {
        recordType: this.toPrismaRecordType(recordType),
        recordId,
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => this.toCorrectionEvent(row));
  }

  async appendCorrection(
    event: Omit<HistoricalRecordCorrectionEvent, "id" | "createdAt">,
    tx?: AppTransactionClient,
  ): Promise<HistoricalRecordCorrectionEvent> {
    const client = tx ?? this.prisma;
    const row = await client.historicalRecordCorrectionEvent.create({
      data: {
        campusId: event.campusId,
        recordType: this.toPrismaRecordType(event.recordType),
        recordId: event.recordId,
        actorId: event.actorId,
        reason: event.reason,
        beforeValue: toJson(event.beforeValue),
        afterValue: toJson(event.afterValue),
      },
    });
    return this.toCorrectionEvent(row);
  }

  async findRetentionPolicy(
    campusId: string,
    environment?: string | null,
  ): Promise<HistoricalRetentionPolicy | null> {
    const env = environment ?? process.env.NODE_ENV ?? null;
    const candidates = [
      { campusId, environment: env },
      { campusId, environment: null },
      { campusId: null, environment: env },
      { campusId: null, environment: null },
    ];

    for (const candidate of candidates) {
      const policy = await this.prisma.historicalRetentionPolicy.findFirst({
        where: {
          campusId: candidate.campusId,
          environment: candidate.environment,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
      });
      if (policy) {
        return {
          id: policy.id,
          campusId: policy.campusId,
          environment: policy.environment,
          policySource: policy.policySource,
          retentionDays: policy.retentionDays,
          deletionAllowed: policy.deletionAllowed,
          redactionAllowed: policy.redactionAllowed,
          isActive: policy.isActive,
        };
      }
    }

    return null;
  }

  async archiveRecord(
    recordType: HistoricalRecordType,
    recordId: string,
    state: HistoricalRecordWriteState,
    tx?: AppTransactionClient,
  ): Promise<void> {
    const data = this.toStateUpdate(state);
    const client = tx ?? this.prisma;
    if (recordType === "ENROLLMENT") {
      await client.enrollment.update({ where: { id: recordId }, data });
      return;
    }
    await client.schoolYearEnrollment.update({ where: { id: recordId }, data });
  }

  async redactRecord(
    recordType: HistoricalRecordType,
    recordId: string,
    state: HistoricalRecordWriteState,
    tx?: AppTransactionClient,
  ): Promise<void> {
    const data = {
      ...this.toStateUpdate(state),
      snapshotStudentFullName: null,
      snapshotStudentCode: null,
      snapshotStudentNickname: null,
    };
    const client = tx ?? this.prisma;
    if (recordType === "ENROLLMENT") {
      await client.enrollment.update({ where: { id: recordId }, data });
      return;
    }
    await client.schoolYearEnrollment.update({ where: { id: recordId }, data });
  }

  async deleteRecord(
    recordType: HistoricalRecordType,
    recordId: string,
    tx?: AppTransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    if (recordType === "ENROLLMENT") {
      await client.enrollment.delete({ where: { id: recordId } });
      return;
    }
    await client.schoolYearEnrollment.delete({ where: { id: recordId } });
  }

  async countRetainedHistoricalRecords(
    studentId: string,
    campusId: string,
  ): Promise<number> {
    const [enrollments, schoolYearEnrollments] = await Promise.all([
      this.prisma.enrollment.count({
        where: {
          studentId,
          redactedAt: null,
          class: { campusId },
        },
      }),
      this.prisma.schoolYearEnrollment.count({
        where: {
          studentId,
          campusId,
          redactedAt: null,
        },
      }),
    ]);
    return enrollments + schoolYearEnrollments;
  }

  private toPrismaRecordType(
    recordType: HistoricalRecordType,
  ): PrismaHistoricalRecordType {
    return recordType === "ENROLLMENT"
      ? PrismaHistoricalRecordType.ENROLLMENT
      : PrismaHistoricalRecordType.SCHOOL_YEAR_ENROLLMENT;
  }

  private toCorrectionEvent(row: {
    id: string;
    campusId: string;
    recordType: PrismaHistoricalRecordType;
    recordId: string;
    actorId: string;
    reason: string;
    beforeValue: Prisma.JsonValue;
    afterValue: Prisma.JsonValue;
    createdAt: Date;
  }): HistoricalRecordCorrectionEvent {
    return {
      id: row.id,
      campusId: row.campusId,
      recordType:
        row.recordType === PrismaHistoricalRecordType.ENROLLMENT
          ? "ENROLLMENT"
          : "SCHOOL_YEAR_ENROLLMENT",
      recordId: row.recordId,
      actorId: row.actorId,
      reason: row.reason,
      beforeValue: row.beforeValue as HistoricalCorrectionPatch,
      afterValue: row.afterValue as HistoricalCorrectionPatch,
      createdAt: row.createdAt,
    };
  }

  private toStateUpdate(state: HistoricalRecordWriteState) {
    return {
      archivedAt: state.archivedAt,
      redactedAt: state.redactedAt,
      retentionExpiresAt: state.retentionExpiresAt,
      retentionPolicySource: state.retentionPolicySource,
      updatedAt: new Date(),
    };
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
