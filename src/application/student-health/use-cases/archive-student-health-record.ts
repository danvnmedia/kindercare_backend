import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

import {
  AuditEventRecorderPort,
  AuditTargetType,
  computeDiff,
} from "@/application/audit";
import {
  AppTransactionClient,
  TransactionRunnerPort,
} from "@/application/ports/transaction-runner.port";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { AuditAction } from "@/domain/audit";
import { User } from "@/domain/user-management/user.entity";

import {
  assertStudentWritable,
  getStudentInCampusOrThrow,
} from "./student-health-student-scope";

export interface ArchivableStudentHealthRecord {
  readonly id: string;
  readonly campusId: string;
  readonly studentId: string;
  readonly archivedAt: Date | null;
  readonly archivedByUserId: string | null;
  readonly isArchived: boolean;
  archive(actorUserId: string, archivedAt?: Date): boolean;
}

export interface StudentHealthArchiveRepository<
  TRecord extends ArchivableStudentHealthRecord,
> {
  findByIdForStudentInCampus(
    campusId: string,
    studentId: string,
    recordId: string,
    tx?: AppTransactionClient,
  ): Promise<TRecord | null>;
  archiveIfActive(
    record: TRecord,
    tx?: AppTransactionClient,
  ): Promise<TRecord | null>;
}

export interface ArchiveStudentHealthRecordOptions<
  TRecord extends ArchivableStudentHealthRecord,
> {
  campusId: string;
  studentId: string;
  recordId: string;
  currentUser: User;
  now: Date;
  repository: StudentHealthArchiveRepository<TRecord>;
  studentRepository: StudentRepository;
  transactionRunner: TransactionRunnerPort;
  auditRecorder: AuditEventRecorderPort;
  auditAction: AuditAction;
  auditTargetType: AuditTargetType;
  notFoundMessage: string;
}

export async function archiveStudentHealthRecord<
  TRecord extends ArchivableStudentHealthRecord,
>(options: ArchiveStudentHealthRecordOptions<TRecord>): Promise<TRecord> {
  const initialRecord = await options.repository.findByIdForStudentInCampus(
    options.campusId,
    options.studentId,
    options.recordId,
  );
  if (!initialRecord) {
    throw new NotFoundException(options.notFoundMessage);
  }
  if (initialRecord.isArchived) {
    return initialRecord;
  }

  const student = await getStudentInCampusOrThrow(
    options.studentRepository,
    options.campusId,
    options.studentId,
  );
  assertStudentWritable(student);

  return options.transactionRunner.run(async (tx) => {
    const record = await options.repository.findByIdForStudentInCampus(
      options.campusId,
      options.studentId,
      options.recordId,
      tx,
    );
    if (!record) {
      throw new NotFoundException(options.notFoundMessage);
    }
    if (record.isArchived) {
      return record;
    }

    const beforeArchive = pickStudentHealthArchiveAuditFields(record);
    record.archive(options.currentUser.id, options.now);
    const saved = await options.repository.archiveIfActive(record, tx);

    if (!saved) {
      const persisted = await options.repository.findByIdForStudentInCampus(
        options.campusId,
        options.studentId,
        options.recordId,
        tx,
      );
      if (!persisted) {
        throw new NotFoundException(options.notFoundMessage);
      }
      if (persisted.isArchived) {
        return persisted;
      }

      const currentStudent = await getStudentInCampusOrThrow(
        options.studentRepository,
        options.campusId,
        options.studentId,
      );
      if (currentStudent.isArchived) {
        throw new BadRequestException("Archived students cannot be mutated");
      }

      throw new ConflictException("Health record could not be archived");
    }

    const diff = computeDiff(
      beforeArchive,
      pickStudentHealthArchiveAuditFields(saved),
    );
    await options.auditRecorder.record(
      {
        actorId: options.currentUser.id,
        action: options.auditAction,
        targetType: options.auditTargetType,
        targetId: saved.id,
        campusId: options.campusId,
        context: {
          actorName: options.currentUser.profile?.fullName ?? null,
          studentId: options.studentId,
        },
        beforeValue: diff.before,
        afterValue: diff.after,
      },
      tx,
    );

    return saved;
  });
}

export function pickStudentHealthArchiveAuditFields(
  record: ArchivableStudentHealthRecord,
): Record<string, unknown> {
  return {
    archivedAt: record.archivedAt?.toISOString() ?? null,
    archivedByUserId: record.archivedByUserId,
    isArchived: record.isArchived,
  };
}
