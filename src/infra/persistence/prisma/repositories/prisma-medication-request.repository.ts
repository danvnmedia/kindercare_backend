import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import {
  MedicationRequestListFilters,
  MedicationRequestRepository,
  StaffMedicationRequestListParams,
  StudentMedicationHistoryParams,
} from "@/application/medication";
import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import {
  MedicationAdministrationOccurrence,
  MedicationRequest,
  MedicationRequestStatus,
  MedicationRequestTimelineAction,
  MedicationRequestTimelineActorType,
  MedicationRequestTimelineEntry,
  normalizeDateOnly,
} from "@/domain/medication";

import { PrismaMedicationRequestMapper } from "../mapper/prisma-medication-request.mapper";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaMedicationRequestRepository
  implements MedicationRequestRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findByIdInCampus(
    campusId: string,
    id: string,
    tx?: AppTransactionClient,
  ): Promise<MedicationRequest | null> {
    const client = tx ?? this.prisma;
    const row = await client.medicationRequest.findFirst({
      where: { id, campusId },
      include: PrismaMedicationRequestMapper.include,
    });

    return row ? PrismaMedicationRequestMapper.toDomain(row) : null;
  }

  async findByCampusId(
    campusId: string,
    params: StaffMedicationRequestListParams,
  ): Promise<PaginatedResult<MedicationRequest>> {
    params.allowedFilterFields = [
      "status",
      "studentId",
      "createdAt",
      "updatedAt",
      "startDate",
      "endDate",
    ];
    params.allowedSortFields = ["createdAt", "updatedAt", "startDate"];

    return this.queryService.executeQuery<MedicationRequest>(
      this.prisma,
      "medicationRequest",
      params,
      {
        dateFilterFields: ["createdAt", "updatedAt", "startDate", "endDate"],
        include: PrismaMedicationRequestMapper.include,
        orderBy: { createdAt: "desc" },
        scope: this.buildStaffListScope(campusId, params),
      },
      PrismaMedicationRequestMapper,
    );
  }

  async findDetailByIdInCampus(
    campusId: string,
    id: string,
    tx?: AppTransactionClient,
  ): Promise<MedicationRequest | null> {
    const client = tx ?? this.prisma;
    const row = await client.medicationRequest.findFirst({
      where: { id, campusId },
      include: PrismaMedicationRequestMapper.detailInclude,
    });

    return row ? PrismaMedicationRequestMapper.toDomain(row) : null;
  }

  async findByStudentInCampus(
    campusId: string,
    studentId: string,
    params: StudentMedicationHistoryParams,
  ): Promise<PaginatedResult<MedicationRequest>> {
    const where = this.buildStudentHistoryWhere(campusId, studentId, params);
    const limit = normalizeLimit(params.limit, params.defaultLimit);
    const offset = normalizeOffset(params.offset);

    const [rows, count] = await Promise.all([
      this.prisma.medicationRequest.findMany({
        where,
        include: PrismaMedicationRequestMapper.detailInclude,
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        skip: offset,
        take: limit,
      }),
      this.prisma.medicationRequest.count({ where }),
    ]);

    return {
      data: rows.map(PrismaMedicationRequestMapper.toDomain),
      pagination: {
        count,
        limit,
        offset,
        totalPages: count === 0 ? 0 : Math.ceil(count / limit),
        currentPage: Math.floor(offset / limit) + 1,
        hasNext: offset + limit < count,
        hasPrev: offset > 0,
      },
    };
  }

  async countHealthCenterSummaryByCampus(campusId: string): Promise<{
    pendingRequests: number;
    needsMoreInfo: number;
  }> {
    const [pendingRequests, needsMoreInfo] = await Promise.all([
      this.prisma.medicationRequest.count({
        where: {
          campusId,
          status: MedicationRequestStatus.SUBMITTED,
        },
      }),
      this.prisma.medicationRequest.count({
        where: {
          campusId,
          status: MedicationRequestStatus.NEEDS_MORE_INFO,
        },
      }),
    ]);

    return {
      pendingRequests,
      needsMoreInfo,
    };
  }

  async findByIdForRequesterGuardian(
    campusId: string,
    requesterGuardianId: string,
    id: string,
    tx?: AppTransactionClient,
  ): Promise<MedicationRequest | null> {
    const client = tx ?? this.prisma;
    const row = await client.medicationRequest.findFirst({
      where: { id, campusId, requesterGuardianId },
      include: PrismaMedicationRequestMapper.include,
    });

    return row ? PrismaMedicationRequestMapper.toDomain(row) : null;
  }

  async findDetailByIdForRequesterGuardian(
    campusId: string,
    requesterGuardianId: string,
    id: string,
    tx?: AppTransactionClient,
  ): Promise<MedicationRequest | null> {
    const client = tx ?? this.prisma;
    const row = await client.medicationRequest.findFirst({
      where: { id, campusId, requesterGuardianId },
      include: PrismaMedicationRequestMapper.detailInclude,
    });

    return row ? PrismaMedicationRequestMapper.toDomain(row) : null;
  }

  async findByRequesterGuardianId(
    campusId: string,
    requesterGuardianId: string,
    filters: MedicationRequestListFilters = {},
  ): Promise<MedicationRequest[]> {
    const rows = await this.prisma.medicationRequest.findMany({
      where: this.buildGuardianListWhere(
        campusId,
        requesterGuardianId,
        filters,
      ),
      include: PrismaMedicationRequestMapper.include,
      orderBy: { createdAt: "desc" },
    });

    return rows.map(PrismaMedicationRequestMapper.toDomain);
  }

  async create(
    medicationRequest: MedicationRequest,
    tx?: AppTransactionClient,
  ): Promise<MedicationRequest> {
    const client = tx ?? this.prisma;
    const created = await client.medicationRequest.create({
      data: PrismaMedicationRequestMapper.toPrismaCreate(medicationRequest),
      include: PrismaMedicationRequestMapper.include,
    });

    return PrismaMedicationRequestMapper.toDomain(created);
  }

  async update(
    medicationRequest: MedicationRequest,
    tx?: AppTransactionClient,
  ): Promise<MedicationRequest> {
    const client = tx ?? this.prisma;
    const updated = await client.medicationRequest.update({
      where: { id: medicationRequest.id },
      data: PrismaMedicationRequestMapper.toPrismaUpdate(medicationRequest),
      include: PrismaMedicationRequestMapper.include,
    });

    return PrismaMedicationRequestMapper.toDomain(updated);
  }

  async updateForRequesterGuardianIfStatusIn(
    medicationRequest: MedicationRequest,
    campusId: string,
    requesterGuardianId: string,
    allowedStatuses: MedicationRequestStatus[],
    tx?: AppTransactionClient,
  ): Promise<MedicationRequest | null> {
    const client = tx ?? this.prisma;
    const result = await client.medicationRequest.updateMany({
      where: {
        id: medicationRequest.id,
        campusId,
        requesterGuardianId,
        status: { in: allowedStatuses },
      },
      data: PrismaMedicationRequestMapper.toPrismaUpdateMany(medicationRequest),
    });

    if (result.count === 0) {
      return null;
    }

    return this.findByIdForRequesterGuardian(
      campusId,
      requesterGuardianId,
      medicationRequest.id,
      tx,
    );
  }

  async updateInCampusIfStatusIn(
    medicationRequest: MedicationRequest,
    campusId: string,
    allowedStatuses: MedicationRequestStatus[],
    tx?: AppTransactionClient,
  ): Promise<MedicationRequest | null> {
    const client = tx ?? this.prisma;
    const result = await client.medicationRequest.updateMany({
      where: {
        id: medicationRequest.id,
        campusId,
        status: { in: allowedStatuses },
      },
      data: PrismaMedicationRequestMapper.toPrismaUpdateMany(medicationRequest),
    });

    if (result.count === 0) {
      return null;
    }

    return this.findByIdInCampus(campusId, medicationRequest.id, tx);
  }

  async createOccurrences(
    occurrences: MedicationAdministrationOccurrence[],
    tx?: AppTransactionClient,
  ): Promise<number> {
    if (occurrences.length === 0) {
      return 0;
    }

    const client = tx ?? this.prisma;
    const result = await client.medicationAdministrationOccurrence.createMany({
      data: occurrences.map((occurrence) =>
        PrismaMedicationRequestMapper.toPrismaOccurrenceCreate(occurrence),
      ),
    });

    return result.count;
  }

  async addTimelineEntry(
    timelineEntry: MedicationRequestTimelineEntry,
    tx?: AppTransactionClient,
  ): Promise<MedicationRequestTimelineEntry> {
    const client = tx ?? this.prisma;
    const created = await client.medicationRequestTimelineEntry.create({
      data: PrismaMedicationRequestMapper.toPrismaTimelineCreate(timelineEntry),
    });

    return MedicationRequestTimelineEntry.create(
      {
        requestId: created.requestId,
        campusId: created.campusId,
        actorType: created.actorType as MedicationRequestTimelineActorType,
        actorUserId: created.actorUserId,
        actorGuardianId: created.actorGuardianId,
        action: created.action as MedicationRequestTimelineAction,
        note: created.note,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
      created.id,
    );
  }

  private buildGuardianListWhere(
    campusId: string,
    requesterGuardianId: string,
    filters: MedicationRequestListFilters,
  ): Prisma.MedicationRequestWhereInput {
    const where: Prisma.MedicationRequestWhereInput = {
      campusId,
      requesterGuardianId,
    };

    if (filters.studentId) {
      where.studentId = filters.studentId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const fromDate = filters.fromDate
      ? normalizeDateOnly(filters.fromDate, "From date")
      : null;
    const toDate = filters.toDate
      ? normalizeDateOnly(filters.toDate, "To date")
      : null;

    if (fromDate && toDate && toDate.getTime() < fromDate.getTime()) {
      throw new Error("To date must be on or after from date");
    }

    if (fromDate) {
      where.endDate = { gte: fromDate };
    }

    if (toDate) {
      where.startDate = { lte: toDate };
    }

    return where;
  }

  private buildStaffListScope(
    campusId: string,
    params: StaffMedicationRequestListParams,
  ): Prisma.MedicationRequestWhereInput {
    const scope: Prisma.MedicationRequestWhereInput = { campusId };

    if (params.status) {
      scope.status = params.status;
    }

    if (params.studentId) {
      scope.studentId = params.studentId;
    }

    if (params.classId) {
      scope.student = {
        enrollments: {
          some: {
            classId: params.classId,
            endDate: null,
          },
        },
      };
    }

    const fromDate = params.fromDate
      ? normalizeDateOnly(params.fromDate, "From date")
      : null;
    const toDate = params.toDate
      ? normalizeDateOnly(params.toDate, "To date")
      : null;

    if (fromDate && toDate && toDate.getTime() < fromDate.getTime()) {
      throw new Error("To date must be on or after from date");
    }

    if (fromDate) {
      scope.endDate = { gte: fromDate };
    }

    if (toDate) {
      scope.startDate = { lte: toDate };
    }

    const search = params.search?.trim();

    if (search) {
      scope.OR = [
        { reason: { contains: search, mode: "insensitive" } },
        { parentNotes: { contains: search, mode: "insensitive" } },
        { student: { fullName: { contains: search, mode: "insensitive" } } },
        { student: { studentCode: { contains: search, mode: "insensitive" } } },
        {
          requesterGuardian: {
            fullName: { contains: search, mode: "insensitive" },
          },
        },
        {
          requesterGuardian: {
            email: { contains: search, mode: "insensitive" },
          },
        },
        {
          items: {
            some: {
              medicationName: { contains: search, mode: "insensitive" },
            },
          },
        },
      ];
    }

    return scope;
  }

  private buildStudentHistoryWhere(
    campusId: string,
    studentId: string,
    params: StudentMedicationHistoryParams,
  ): Prisma.MedicationRequestWhereInput {
    const where: Prisma.MedicationRequestWhereInput = {
      campusId,
      studentId,
    };

    if (params.status) {
      where.status = params.status;
    }

    const fromDate = params.fromDate
      ? normalizeDateOnly(params.fromDate, "From date")
      : null;
    const toDate = params.toDate
      ? normalizeDateOnly(params.toDate, "To date")
      : null;

    if (fromDate && toDate && toDate.getTime() < fromDate.getTime()) {
      throw new Error("To date must be on or after from date");
    }

    if (fromDate) {
      where.endDate = { gte: fromDate };
    }

    if (toDate) {
      where.startDate = { lte: toDate };
    }

    return where;
  }
}

function normalizeLimit(
  limit: number | string | undefined,
  defaultLimit?: number,
): number {
  const value = Number(limit ?? defaultLimit ?? 10);

  if (!Number.isFinite(value) || value <= 0) {
    return 10;
  }

  return Math.min(Math.trunc(value), 50);
}

function normalizeOffset(offset: number | string | undefined): number {
  const value = Number(offset ?? 0);

  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.trunc(value);
}
