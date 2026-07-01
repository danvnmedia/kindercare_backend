import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { StudentHealthProfileRepository } from "@/application/student-health";
import { StudentHealthProfile } from "@/domain/student-health";

import { PrismaStudentHealthProfileMapper } from "../mapper/prisma-student-health-profile.mapper";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaStudentHealthProfileRepository
  implements StudentHealthProfileRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findByStudentInCampus(
    campusId: string,
    studentId: string,
  ): Promise<StudentHealthProfile | null> {
    const row = await this.prisma.studentHealthProfile.findFirst({
      where: { campusId, studentId },
      include: PrismaStudentHealthProfileMapper.include,
    });

    return row ? PrismaStudentHealthProfileMapper.toDomain(row) : null;
  }

  async getOrCreateEmpty(
    campusId: string,
    studentId: string,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthProfile> {
    const client = tx ?? this.prisma;
    const row = await client.studentHealthProfile.upsert({
      where: { studentId },
      create: {
        campusId,
        studentId,
        allergies: [] as Prisma.InputJsonValue,
        conditions: [] as Prisma.InputJsonValue,
        restrictions: [] as Prisma.InputJsonValue,
      },
      update: {},
      include: PrismaStudentHealthProfileMapper.include,
    });

    return PrismaStudentHealthProfileMapper.toDomain(row);
  }

  async update(
    profile: StudentHealthProfile,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthProfile> {
    const client = tx ?? this.prisma;
    const row = await client.studentHealthProfile.update({
      where: { id: profile.id },
      data: PrismaStudentHealthProfileMapper.toPrismaUpdate(profile),
      include: PrismaStudentHealthProfileMapper.include,
    });

    return PrismaStudentHealthProfileMapper.toDomain(row);
  }
}
