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

  async findByCampusId(campusId: string): Promise<StaffType[]> {
    const prismaStaffTypes = await this.prisma.staffType.findMany({
      where: { campusId },
      include: { defaultRole: true },
      orderBy: { name: "asc" },
    });
    return PrismaStaffTypeMapper.toDomainArray(prismaStaffTypes);
  }

  async findAll(params: StandardRequest): Promise<PaginatedResult<StaffType>> {
    params.allowedFilterFields = [
      "campusId",
      "name",
      "description",
      "isActive",
      "defaultRoleId",
    ];
    params.allowedSortFields = ["name", "createdAt", "updatedAt", "isActive"];

    return await this.queryService.executeQuery<StaffType>(
      this.prisma,
      "staffType",
      params,
      {
        orderBy: { name: "asc" },
        include: { defaultRole: true },
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

  async existsAndActive(id: string): Promise<boolean> {
    const count = await this.prisma.staffType.count({
      where: { id, isActive: true },
    });
    return count > 0;
  }
}
