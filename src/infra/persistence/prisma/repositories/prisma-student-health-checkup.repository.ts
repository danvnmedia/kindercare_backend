import { Injectable } from "@nestjs/common";

import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import {
  StudentHealthCheckupListParams,
  StudentHealthCheckupRepository,
} from "@/application/student-health";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { StudentHealthCheckup } from "@/domain/student-health";

import { PrismaStudentHealthCheckupMapper } from "../mapper/prisma-student-health-checkup.mapper";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaStudentHealthCheckupRepository
  implements StudentHealthCheckupRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findByStudentInCampus(
    campusId: string,
    studentId: string,
    params: StudentHealthCheckupListParams,
  ): Promise<PaginatedResult<StudentHealthCheckup>> {
    params.allowedFilterFields = [
      "checkupType",
      "checkedAt",
      "heightCm",
      "weightKg",
      "createdAt",
      "updatedAt",
    ];
    params.allowedSortFields = [
      "checkupType",
      "checkedAt",
      "heightCm",
      "weightKg",
      "createdAt",
      "updatedAt",
    ];

    return this.queryService.executeQuery<StudentHealthCheckup>(
      this.prisma,
      "studentHealthCheckup",
      params,
      {
        dateFilterFields: ["checkedAt", "createdAt", "updatedAt"],
        include: PrismaStudentHealthCheckupMapper.include,
        orderBy: { checkedAt: "desc" },
        scope: {
          campusId,
          studentId,
          ...(params.includeArchived === true ? {} : { archivedAt: null }),
        },
      },
      PrismaStudentHealthCheckupMapper,
    );
  }

  async findByIdForStudentInCampus(
    campusId: string,
    studentId: string,
    checkupId: string,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthCheckup | null> {
    const client = tx ?? this.prisma;
    const row = await client.studentHealthCheckup.findFirst({
      where: { id: checkupId, campusId, studentId },
      include: PrismaStudentHealthCheckupMapper.include,
    });

    return row ? PrismaStudentHealthCheckupMapper.toDomain(row) : null;
  }

  async create(
    checkup: StudentHealthCheckup,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthCheckup> {
    const client = tx ?? this.prisma;
    const created = await client.studentHealthCheckup.create({
      data: PrismaStudentHealthCheckupMapper.toPrismaCreate(checkup),
      include: PrismaStudentHealthCheckupMapper.include,
    });

    return PrismaStudentHealthCheckupMapper.toDomain(created);
  }

  async archiveIfActive(
    checkup: StudentHealthCheckup,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthCheckup | null> {
    const client = tx ?? this.prisma;
    if (!checkup.archivedAt || !checkup.archivedByUserId) {
      throw new Error("Archived health checkup metadata is required");
    }

    const result = await client.studentHealthCheckup.updateMany({
      where: {
        id: checkup.id,
        campusId: checkup.campusId,
        studentId: checkup.studentId,
        archivedAt: null,
        student: { isArchived: false },
      },
      data: {
        archivedAt: checkup.archivedAt,
        archivedByUserId: checkup.archivedByUserId,
        updatedAt: checkup.updatedAt,
      },
    });

    return result.count === 1
      ? this.findByIdForStudentInCampus(
          checkup.campusId,
          checkup.studentId,
          checkup.id,
          tx,
        )
      : null;
  }

  async updateIfActive(
    checkup: StudentHealthCheckup,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthCheckup | null> {
    const client = tx ?? this.prisma;
    const result = await client.studentHealthCheckup.updateMany({
      where: {
        id: checkup.id,
        campusId: checkup.campusId,
        studentId: checkup.studentId,
        archivedAt: null,
        student: { isArchived: false },
      },
      data: PrismaStudentHealthCheckupMapper.toPrismaUpdate(checkup),
    });

    return result.count === 1
      ? this.findByIdForStudentInCampus(
          checkup.campusId,
          checkup.studentId,
          checkup.id,
          tx,
        )
      : null;
  }
}
