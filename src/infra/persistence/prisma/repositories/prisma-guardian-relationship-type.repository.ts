import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { GuardianRelationshipTypeRepository } from "@/application/user-management/ports/guardian-relationship-type.repository";
import { GuardianRelationshipType } from "@/domain/user-management/entities/guardian-relationship-type.entity";
import { PrismaGuardianRelationshipTypeMapper } from "../mapper/prisma-guardian-relationship-type.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

@Injectable()
export class PrismaGuardianRelationshipTypeRepository
  implements GuardianRelationshipTypeRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<GuardianRelationshipType | null> {
    const record = await this.prisma.guardianRelationship.findUnique({
      where: { id },
    });
    return record
      ? PrismaGuardianRelationshipTypeMapper.toDomain(record)
      : null;
  }

  async findByName(
    campusId: string,
    name: string,
  ): Promise<GuardianRelationshipType | null> {
    const record = await this.prisma.guardianRelationship.findFirst({
      where: { campusId, name },
    });
    return record
      ? PrismaGuardianRelationshipTypeMapper.toDomain(record)
      : null;
  }

  async findByOrderAndCampus(
    order: number,
    campusId: string,
  ): Promise<GuardianRelationshipType | null> {
    const record = await this.prisma.guardianRelationship.findFirst({
      where: { order, campusId },
    });
    return record
      ? PrismaGuardianRelationshipTypeMapper.toDomain(record)
      : null;
  }

  async findByCampusId(campusId: string): Promise<GuardianRelationshipType[]> {
    const records = await this.prisma.guardianRelationship.findMany({
      where: { campusId },
      orderBy: { order: "asc" },
    });
    return PrismaGuardianRelationshipTypeMapper.toDomainArray(records);
  }

  async findAll(
    params: StandardRequest,
    scope?: Record<string, any>,
  ): Promise<PaginatedResult<GuardianRelationshipType>> {
    params.allowedFilterFields = ["name", "description", "isArchived", "order"];
    params.allowedSortFields = [
      "name",
      "order",
      "createdAt",
      "updatedAt",
      "isArchived",
    ];

    return await this.queryService.executeQuery<GuardianRelationshipType>(
      this.prisma,
      "guardianRelationship",
      params,
      {
        orderBy: { order: "asc" },
        scope,
      },
      PrismaGuardianRelationshipTypeMapper,
    );
  }

  async save(
    type: GuardianRelationshipType,
  ): Promise<GuardianRelationshipType> {
    const prismaData = PrismaGuardianRelationshipTypeMapper.toPrisma(type);
    const created = await this.prisma.guardianRelationship.create({
      data: prismaData,
    });
    return PrismaGuardianRelationshipTypeMapper.toDomain(created);
  }

  async update(
    type: GuardianRelationshipType,
  ): Promise<GuardianRelationshipType> {
    const prismaData =
      PrismaGuardianRelationshipTypeMapper.toPrismaUpdate(type);
    const updated = await this.prisma.guardianRelationship.update({
      where: { id: type.id },
      data: prismaData,
    });
    return PrismaGuardianRelationshipTypeMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.guardianRelationship.delete({
      where: { id },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.guardianRelationship.count({
      where: { id },
    });
    return count > 0;
  }

  async existsAndNotArchived(id: string): Promise<boolean> {
    const count = await this.prisma.guardianRelationship.count({
      where: { id, isArchived: false },
    });
    return count > 0;
  }

  async getMaxOrder(campusId: string): Promise<number> {
    const result = await this.prisma.guardianRelationship.aggregate({
      where: { campusId },
      _max: { order: true },
    });
    return result._max.order ?? 0;
  }

  async reorder(
    campusId: string,
    ids: string[],
  ): Promise<GuardianRelationshipType[]> {
    // Two-phase update to avoid unique constraint violation on 'order' field
    await this.prisma.$transaction([
      // Phase 1: Temporarily set to negative values
      ...ids.map((id, index) =>
        this.prisma.guardianRelationship.update({
          where: { id },
          data: { order: -(index + 1) },
        }),
      ),
      // Phase 2: Set to final positive values
      ...ids.map((id, index) =>
        this.prisma.guardianRelationship.update({
          where: { id },
          data: { order: index + 1 },
        }),
      ),
    ]);

    const updated = await this.prisma.guardianRelationship.findMany({
      where: { id: { in: ids }, campusId },
      orderBy: { order: "asc" },
    });

    return PrismaGuardianRelationshipTypeMapper.toDomainArray(updated);
  }
}
