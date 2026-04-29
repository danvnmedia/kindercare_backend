import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { StaffTypeRepository } from "@/application/user-management/ports/staff-type.repository";
import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { PrismaStaffTypeMapper } from "../mapper/prisma-staff-type.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

@Injectable()
export class PrismaStaffTypeRepository implements StaffTypeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<StaffType | null> {
    const prismaStaffType = await this.prisma.staffType.findUnique({
      where: { id },
      include: { defaultRole: true },
    });
    return prismaStaffType
      ? PrismaStaffTypeMapper.toDomain(prismaStaffType)
      : null;
  }

  async findByName(campusId: string, name: string): Promise<StaffType | null> {
    const prismaStaffType = await this.prisma.staffType.findFirst({
      where: { campusId, name },
      include: { defaultRole: true },
    });
    return prismaStaffType
      ? PrismaStaffTypeMapper.toDomain(prismaStaffType)
      : null;
  }

  async findByOrderAndCampus(
    order: number,
    campusId: string,
  ): Promise<StaffType | null> {
    const prismaStaffType = await this.prisma.staffType.findFirst({
      where: { order, campusId },
      include: { defaultRole: true },
    });
    return prismaStaffType
      ? PrismaStaffTypeMapper.toDomain(prismaStaffType)
      : null;
  }

  async findByCampusId(campusId: string): Promise<StaffType[]> {
    const prismaStaffTypes = await this.prisma.staffType.findMany({
      where: { campusId },
      include: { defaultRole: true },
      orderBy: { order: "asc" },
    });
    return PrismaStaffTypeMapper.toDomainArray(prismaStaffTypes);
  }

  async findAll(
    params: StandardRequest,
    scope?: Record<string, any>,
  ): Promise<PaginatedResult<StaffType>> {
    params.allowedFilterFields = [
      "name",
      "description",
      "isArchived",
      "defaultRoleId",
      "order",
    ];
    params.allowedSortFields = [
      "name",
      "order",
      "createdAt",
      "updatedAt",
      "isArchived",
    ];

    return await this.queryService.executeQuery<StaffType>(
      this.prisma,
      "staffType",
      params,
      {
        orderBy: { order: "asc" },
        include: { defaultRole: true },
        scope,
      },
      PrismaStaffTypeMapper,
    );
  }

  async save(staffType: StaffType): Promise<StaffType> {
    const prismaData = PrismaStaffTypeMapper.toPrisma(staffType);
    const created = await this.prisma.staffType.create({
      data: prismaData,
      include: { defaultRole: true },
    });
    return PrismaStaffTypeMapper.toDomain(created);
  }

  async update(staffType: StaffType): Promise<StaffType> {
    const prismaData = PrismaStaffTypeMapper.toPrismaUpdate(staffType);
    const updated = await this.prisma.staffType.update({
      where: { id: staffType.id },
      data: prismaData,
      include: { defaultRole: true },
    });
    return PrismaStaffTypeMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.staffType.delete({
      where: { id },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.staffType.count({
      where: { id },
    });
    return count > 0;
  }

  async existsAndNotArchived(id: string): Promise<boolean> {
    const count = await this.prisma.staffType.count({
      where: { id, isArchived: false },
    });
    return count > 0;
  }

  async getMaxOrder(campusId: string): Promise<number> {
    const result = await this.prisma.staffType.aggregate({
      where: { campusId },
      _max: { order: true },
    });
    return result._max.order ?? 0;
  }

  async reorder(campusId: string, ids: string[]): Promise<StaffType[]> {
    // Two-phase update to avoid unique constraint violation on 'order' field
    // Phase 1: Set all orders to negative temporary values (avoids collision)
    // Phase 2: Set all orders to final positive values
    await this.prisma.$transaction([
      // Phase 1: Temporarily set to negative values
      // Negative values won't conflict with existing positive orders
      ...ids.map((id, index) =>
        this.prisma.staffType.update({
          where: { id },
          data: { order: -(index + 1) },
        }),
      ),
      // Phase 2: Set to final positive values
      ...ids.map((id, index) =>
        this.prisma.staffType.update({
          where: { id },
          data: { order: index + 1 },
        }),
      ),
    ]);

    // Fetch and return updated staff types sorted by order (within campus)
    const updated = await this.prisma.staffType.findMany({
      where: { id: { in: ids }, campusId },
      include: { defaultRole: true },
      orderBy: { order: "asc" },
    });

    return PrismaStaffTypeMapper.toDomainArray(updated);
  }
}
