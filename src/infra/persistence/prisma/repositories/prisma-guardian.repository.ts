import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { GuardianRepository } from "@/application/user-management/ports/guardian.repository";
import { Guardian } from "@/domain/user-management/guardian.entity";
import { PrismaGuardianMapper } from "../mapper/prisma-guardian.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

@Injectable()
export class PrismaGuardianRepository implements GuardianRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<Guardian | null> {
    const prismaGuardian = await this.prisma.guardian.findUnique({
      where: { id },
      include: {
        spouse: true,
        children: {
          include: {
            student: true,
            guardianRelationship: true,
          },
        },
      },
    });
    return prismaGuardian
      ? PrismaGuardianMapper.toDomain(prismaGuardian)
      : null;
  }

  async findByEmail(email: string): Promise<Guardian | null> {
    const prismaGuardian = await this.prisma.guardian.findUnique({
      where: { email },
      include: {
        spouse: true,
        children: {
          include: {
            student: true,
            guardianRelationship: true,
          },
        },
      },
    });
    return prismaGuardian
      ? PrismaGuardianMapper.toDomain(prismaGuardian)
      : null;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Guardian | null> {
    const prismaGuardian = await this.prisma.guardian.findUnique({
      where: { phoneNumber },
      include: {
        spouse: true,
        children: {
          include: {
            student: true,
            guardianRelationship: true,
          },
        },
      },
    });
    return prismaGuardian
      ? PrismaGuardianMapper.toDomain(prismaGuardian)
      : null;
  }

  async findAll(params: StandardRequest): Promise<PaginatedResult<Guardian>> {
    // Define allowed fields for filtering and sorting
    params.allowedFilterFields = [
      "fullName",
      "email",
      "phoneNumber",
      "gender",
      "occupation",
      "workAddress",
      "isArchived",
    ];
    params.allowedSortFields = [
      "createdAt",
      "updatedAt",
      "fullName",
      "occupation",
    ];

    // Use PrismaQueryService to execute query with StandardRequest
    return await this.queryService.executeQuery<Guardian>(
      this.prisma,
      "guardian",
      params,
      {
        include: {
          children: {
            include: {
              student: true,
              guardianRelationship: true,
            },
          },
          spouse: true,
        },
      },
      PrismaGuardianMapper,
    );
  }

  async findByIds(ids: string[]): Promise<Guardian[]> {
    const guardians = await this.prisma.guardian.findMany({
      where: {
        id: { in: ids },
      },
    });
    return guardians.map(PrismaGuardianMapper.toDomain);
  }

  async save(
    guardian: Omit<Guardian, "id" | "createdAt" | "updatedAt">,
  ): Promise<Guardian> {
    const prismaData = PrismaGuardianMapper.toPrisma(guardian);
    const created = await this.prisma.guardian.create({
      data: prismaData,
    });
    return PrismaGuardianMapper.toDomain(created);
  }

  async update(id: string, data: Partial<Guardian>): Promise<Guardian> {
    const prismaData = PrismaGuardianMapper.toPrismaUpdate(data);
    const updated = await this.prisma.guardian.update({
      where: { id },
      data: prismaData,
    });
    return PrismaGuardianMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.guardian.delete({
      where: { id },
    });
  }

  async getGuardianChildren(guardianId: string): Promise<any[]> {
    const guardianStudents = await this.prisma.guardianStudent.findMany({
      where: { guardianId },
      include: {
        student: true,
        guardianRelationship: true,
      },
    });

    return guardianStudents.map((gs) => ({
      studentId: gs.student.id,
      fullName: gs.student.fullName,
      nickname: gs.student.nickname,
      className: null,
      relationship: gs.guardianRelationship.id,
      relationshipName: gs.guardianRelationship.name,
    }));
  }
}
