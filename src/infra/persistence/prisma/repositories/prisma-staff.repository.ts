import { StaffRepository } from "@/application/user-management/ports/staff.repository";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { StaffType } from "@/domain/user-management/enums/staff-type.enum";
import { Injectable } from "@nestjs/common";
import { PrismaStaffMapper } from "../mapper/prisma-staff.mapper";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaStaffRepository implements StaffRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<Staff | null> {
    const prismaStaff = await this.prisma.staff.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });
    return prismaStaff ? PrismaStaffMapper.toDomain(prismaStaff) : null;
  }

  async findByEmail(email: string): Promise<Staff | null> {
    const prismaStaff = await this.prisma.staff.findFirst({
      where: { email },
    });
    return prismaStaff ? PrismaStaffMapper.toDomainSimple(prismaStaff) : null;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Staff | null> {
    const prismaStaff = await this.prisma.staff.findFirst({
      where: { phoneNumber },
    });
    return prismaStaff ? PrismaStaffMapper.toDomainSimple(prismaStaff) : null;
  }

  async findByUserId(userId: string): Promise<Staff | null> {
    const prismaStaff = await this.prisma.staff.findFirst({
      where: { userId },
      include: {
        user: true,
      },
    });
    return prismaStaff ? PrismaStaffMapper.toDomain(prismaStaff) : null;
  }

  async findByType(type: StaffType): Promise<Staff[]> {
    const prismaStaffs = await this.prisma.staff.findMany({
      where: { staffType: type },
      include: {
        user: true,
      },
    });
    return PrismaStaffMapper.toDomainArray(prismaStaffs);
  }

  async findByIds(ids: string[]): Promise<Staff[]> {
    const prismaStaffs = await this.prisma.staff.findMany({
      where: { id: { in: ids } },
      include: {
        user: true,
      },
    });
    return PrismaStaffMapper.toDomainArray(prismaStaffs);
  }

  async findAll(params: StandardRequest): Promise<PaginatedResult<Staff>> {
    // Define allowed fields for filtering and sorting
    params.allowedFilterFields = [
      "fullName",
      "email",
      "phoneNumber",
      "staffType",
      "gender",
      "isArchived",
    ];
    params.allowedSortFields = [
      "createdAt",
      "updatedAt",
      "fullName",
      "email",
      "staffType",
      "startDate",
    ];

    // Use PrismaQueryService to execute query with StandardRequest
    return await this.queryService.executeQuery<Staff>(
      this.prisma,
      "staff",
      params,
      {
        include: {
          user: true,
        },
      },
      PrismaStaffMapper,
    );
  }

  async save(staff: Staff): Promise<Staff> {
    const prismaData = PrismaStaffMapper.toPrisma(staff);
    const created = await this.prisma.staff.create({
      data: prismaData,
      include: {
        user: true,
      },
    });
    return PrismaStaffMapper.toDomain(created);
  }

  async update(staff: Staff): Promise<Staff> {
    const prismaData = PrismaStaffMapper.toPrismaUpdate(staff);
    const updated = await this.prisma.staff.update({
      where: { id: staff.id },
      data: prismaData,
      include: {
        user: true,
      },
    });
    return PrismaStaffMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.staff.delete({
      where: { id },
    });
  }
}
