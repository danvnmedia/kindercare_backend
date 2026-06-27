import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { GuardianRepository } from "@/application/user-management/ports/guardian.repository";
import {
  Guardian,
  GuardianStudent,
} from "@/domain/user-management/entities/guardian.entity";
import { PrismaGuardianMapper } from "../mapper/prisma-guardian.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { PrismaStudentMapper } from "../mapper/prisma-student.mapper"; // Import Student Mapper

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
    const prismaGuardian = await this.prisma.guardian.findFirst({
      where: { email },
      include: {
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
    const prismaGuardian = await this.prisma.guardian.findFirst({
      where: { phoneNumber },
      include: {
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

  async findByEmailInCampus(
    campusId: string,
    email: string,
  ): Promise<Guardian | null> {
    const prismaGuardian = await this.prisma.guardian.findFirst({
      where: { campusId, email },
      include: {
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

  async findByPhoneNumberInCampus(
    campusId: string,
    phoneNumber: string,
  ): Promise<Guardian | null> {
    const prismaGuardian = await this.prisma.guardian.findFirst({
      where: { campusId, phoneNumber },
      include: {
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

  async findByUserId(userId: string): Promise<Guardian | null> {
    const prismaGuardian = await this.prisma.guardian.findFirst({
      where: { userId },
      include: {
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

  async findByUserIdInCampus(
    userId: string,
    campusId: string,
  ): Promise<Guardian | null> {
    const prismaGuardian = await this.prisma.guardian.findFirst({
      where: {
        userId,
        campusId,
        isArchived: false,
      },
      include: {
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

  async findByCampusId(campusId: string): Promise<Guardian[]> {
    const guardians = await this.prisma.guardian.findMany({
      where: { campusId },
      include: {
        children: {
          include: {
            student: true,
            guardianRelationship: true,
          },
        },
      },
    });
    return guardians.map(PrismaGuardianMapper.toDomain);
  }

  async findAll(
    params: StandardRequest,
    scope?: Record<string, any>,
  ): Promise<PaginatedResult<Guardian>> {
    // Define allowed fields for filtering and sorting
    params.allowedFilterFields = [
      "fullName",
      "email",
      "phoneNumber",
      "gender",
      "occupation",
      "workAddress",
      "isArchived",
      "dateOfBirth",
      "campusId",
    ];
    params.allowedSortFields = [
      "createdAt",
      "updatedAt",
      "fullName",
      "occupation",
      "phoneNumber",
      "dateOfBirth",
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
        },
        orderBy: { createdAt: "desc" },
        scope,
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

  async save(guardian: Guardian): Promise<Guardian> {
    const prismaData = PrismaGuardianMapper.toPrisma(guardian);
    const created = await this.prisma.guardian.create({
      data: prismaData,
    });
    return PrismaGuardianMapper.toDomain(created);
  }

  async update(guardian: Guardian): Promise<Guardian> {
    const prismaData = PrismaGuardianMapper.toPrismaUpdate(guardian);
    const updated = await this.prisma.guardian.update({
      where: { id: guardian.id },
      data: prismaData,
    });
    return PrismaGuardianMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.guardian.delete({
      where: { id },
    });
  }

  async getGuardianChildren(guardianId: string): Promise<GuardianStudent[]> {
    const guardianStudents = await this.prisma.guardianStudent.findMany({
      where: { guardianId },
      include: {
        student: true,
        guardianRelationship: true,
      },
    });

    return guardianStudents.map((gs) => ({
      student: PrismaStudentMapper.toDomain(gs.student),
      guardianRelationship: {
        id: gs.guardianRelationship.id,
        name: gs.guardianRelationship.name,
      },
    }));
  }

  async getGuardianChildrenInCampus(
    guardianId: string,
    campusId: string,
  ): Promise<GuardianStudent[]> {
    const guardianStudents = await this.prisma.guardianStudent.findMany({
      where: {
        guardianId,
        guardian: {
          campusId,
          isArchived: false,
        },
        student: {
          campusId,
          isArchived: false,
        },
      },
      include: {
        student: true,
        guardianRelationship: true,
      },
      orderBy: {
        student: {
          fullName: "asc",
        },
      },
    });

    return guardianStudents.map((gs) => ({
      student: PrismaStudentMapper.toDomain(gs.student),
      guardianRelationship: {
        id: gs.guardianRelationship.id,
        name: gs.guardianRelationship.name,
      },
    }));
  }
}
