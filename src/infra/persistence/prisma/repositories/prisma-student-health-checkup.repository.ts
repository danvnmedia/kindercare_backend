import { Injectable } from "@nestjs/common";

import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { StudentHealthCheckupRepository } from "@/application/student-health";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
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
    params: StandardRequest,
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
        scope: { campusId, studentId },
      },
      PrismaStudentHealthCheckupMapper,
    );
  }

  async findByIdForStudentInCampus(
    campusId: string,
    studentId: string,
    checkupId: string,
  ): Promise<StudentHealthCheckup | null> {
    const row = await this.prisma.studentHealthCheckup.findFirst({
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

  async update(
    checkup: StudentHealthCheckup,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthCheckup> {
    const client = tx ?? this.prisma;
    const updated = await client.studentHealthCheckup.update({
      where: { id: checkup.id },
      data: PrismaStudentHealthCheckupMapper.toPrismaUpdate(checkup),
      include: PrismaStudentHealthCheckupMapper.include,
    });

    return PrismaStudentHealthCheckupMapper.toDomain(updated);
  }
}
