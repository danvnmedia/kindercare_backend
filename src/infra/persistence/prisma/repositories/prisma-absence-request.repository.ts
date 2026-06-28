import { Injectable } from "@nestjs/common";

import {
  AbsenceRequestFindManyOptions,
  AbsenceRequestRepository,
} from "@/application/absence-request";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import {
  AbsencePeriod,
  AbsenceRequest,
  AbsenceRequestStatus,
  normalizeAbsencePeriod,
  normalizeDateOnly,
} from "@/domain/absence-request";

import { PrismaAbsenceRequestMapper } from "../mapper/prisma-absence-request.mapper";
import { PrismaService } from "../prisma.service";

type AbsenceRequestListParams = StandardRequest & {
  status?: AbsenceRequestStatus;
  overlapsDate?: string | Date;
};

@Injectable()
export class PrismaAbsenceRequestRepository
  implements AbsenceRequestRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findByIdInCampus(
    campusId: string,
    id: string,
  ): Promise<AbsenceRequest | null> {
    const row = await this.prisma.absenceRequest.findFirst({
      where: { id, campusId },
      include: PrismaAbsenceRequestMapper.include,
    });

    return row ? PrismaAbsenceRequestMapper.toDomain(row) : null;
  }

  async findByCampusId(
    campusId: string,
    params: AbsenceRequestListParams,
    options: AbsenceRequestFindManyOptions = {},
  ): Promise<PaginatedResult<AbsenceRequest>> {
    params.allowedFilterFields = [
      "status",
      "studentId",
      "requesterGuardianId",
      "createdAt",
      "updatedAt",
      "startDate",
      "endDate",
    ];
    params.allowedSortFields = ["createdAt", "startDate", "updatedAt"];

    return this.queryService.executeQuery<AbsenceRequest>(
      this.prisma,
      "absenceRequest",
      params,
      {
        dateFilterFields: [
          "startDate",
          "endDate",
          "createdAt",
          "updatedAt",
          "reviewedAt",
        ],
        include: PrismaAbsenceRequestMapper.include,
        orderBy: { createdAt: "desc" },
        scope: this.buildListScope(campusId, params, options.scope),
      },
      PrismaAbsenceRequestMapper,
    );
  }

  async findByRequesterGuardianId(
    campusId: string,
    requesterGuardianId: string,
  ): Promise<AbsenceRequest[]> {
    const rows = await this.prisma.absenceRequest.findMany({
      where: { campusId, requesterGuardianId },
      include: PrismaAbsenceRequestMapper.include,
      orderBy: { createdAt: "desc" },
    });

    return rows.map(PrismaAbsenceRequestMapper.toDomain);
  }

  async findActiveOverlaps(
    campusId: string,
    studentId: string,
    period: AbsencePeriod,
  ): Promise<AbsenceRequest[]> {
    const normalizedPeriod = normalizeAbsencePeriod(period);
    const rows = await this.prisma.absenceRequest.findMany({
      where: {
        campusId,
        studentId,
        status: {
          in: [AbsenceRequestStatus.PENDING, AbsenceRequestStatus.APPROVED],
        },
        startDate: { lte: normalizedPeriod.endDate },
        endDate: { gte: normalizedPeriod.startDate },
      },
      include: PrismaAbsenceRequestMapper.include,
    });

    return rows
      .map(PrismaAbsenceRequestMapper.toDomain)
      .filter((absenceRequest) => absenceRequest.overlaps(normalizedPeriod));
  }

  async save(absenceRequest: AbsenceRequest): Promise<AbsenceRequest> {
    const created = await this.prisma.absenceRequest.create({
      data: PrismaAbsenceRequestMapper.toPrisma(absenceRequest),
      include: PrismaAbsenceRequestMapper.include,
    });

    return PrismaAbsenceRequestMapper.toDomain(created);
  }

  async update(absenceRequest: AbsenceRequest): Promise<AbsenceRequest> {
    const updated = await this.prisma.absenceRequest.update({
      where: { id: absenceRequest.id.toString() },
      data: PrismaAbsenceRequestMapper.toPrismaUpdate(absenceRequest),
      include: PrismaAbsenceRequestMapper.include,
    });

    return PrismaAbsenceRequestMapper.toDomain(updated);
  }

  private buildListScope(
    campusId: string,
    params: AbsenceRequestListParams,
    baseScope: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const scope: Record<string, unknown> = {
      ...baseScope,
      campusId,
    };

    if (params.status) {
      scope.status = params.status;
    }

    if (params.overlapsDate) {
      const overlapsDate = normalizeDateOnly(
        params.overlapsDate,
        "Overlaps date",
      );
      scope.startDate = { lte: overlapsDate };
      scope.endDate = { gte: overlapsDate };
    }

    return scope;
  }
}
