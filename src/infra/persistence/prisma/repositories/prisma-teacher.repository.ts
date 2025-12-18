import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { TeacherRepository } from "@/application/user-management/ports/teacher.repository";
import { Teacher } from "@/domain/user-management/entities/teacher.entity";
import { TeacherType } from "@/domain/user-management/enums/teacher-type.enum";
import { PrismaTeacherMapper } from "../mapper/prisma-teacher.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

@Injectable()
export class PrismaTeacherRepository implements TeacherRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<Teacher | null> {
    const prismaTeacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });
    return prismaTeacher ? PrismaTeacherMapper.toDomain(prismaTeacher) : null;
  }

  async findByEmail(email: string): Promise<Teacher | null> {
    const prismaTeacher = await this.prisma.teacher.findFirst({
      where: { email },
    });
    return prismaTeacher
      ? PrismaTeacherMapper.toDomainSimple(prismaTeacher)
      : null;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Teacher | null> {
    const prismaTeacher = await this.prisma.teacher.findFirst({
      where: { phoneNumber },
    });
    return prismaTeacher
      ? PrismaTeacherMapper.toDomainSimple(prismaTeacher)
      : null;
  }

  async findByUserId(userId: string): Promise<Teacher | null> {
    const prismaTeacher = await this.prisma.teacher.findFirst({
      where: { userId },
      include: {
        user: true,
      },
    });
    return prismaTeacher ? PrismaTeacherMapper.toDomain(prismaTeacher) : null;
  }

  async findByType(type: TeacherType): Promise<Teacher[]> {
    const prismaTeachers = await this.prisma.teacher.findMany({
      where: { teacherType: type },
      include: {
        user: true,
      },
    });
    return PrismaTeacherMapper.toDomainArray(prismaTeachers);
  }

  async findByIds(ids: string[]): Promise<Teacher[]> {
    const prismaTeachers = await this.prisma.teacher.findMany({
      where: { id: { in: ids } },
      include: {
        user: true,
      },
    });
    return PrismaTeacherMapper.toDomainArray(prismaTeachers);
  }

  async findAll(params: StandardRequest): Promise<PaginatedResult<Teacher>> {
    // Define allowed fields for filtering and sorting
    params.allowedFilterFields = [
      "fullName",
      "email",
      "phoneNumber",
      "teacherType",
      "gender",
      "isArchived",
    ];
    params.allowedSortFields = [
      "createdAt",
      "updatedAt",
      "fullName",
      "email",
      "teacherType",
      "startDate",
    ];

    // Use PrismaQueryService to execute query with StandardRequest
    return await this.queryService.executeQuery<Teacher>(
      this.prisma,
      "teacher",
      params,
      {
        include: {
          user: true,
        },
      },
      PrismaTeacherMapper,
    );
  }

  async save(teacher: Teacher): Promise<Teacher> {
    const prismaData = PrismaTeacherMapper.toPrisma(teacher);
    const created = await this.prisma.teacher.create({
      data: prismaData,
      include: {
        user: true,
      },
    });
    return PrismaTeacherMapper.toDomain(created);
  }

  async update(teacher: Teacher): Promise<Teacher> {
    const prismaData = PrismaTeacherMapper.toPrismaUpdate(teacher);
    const updated = await this.prisma.teacher.update({
      where: { id: teacher.id },
      data: prismaData,
      include: {
        user: true,
      },
    });
    return PrismaTeacherMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.teacher.delete({
      where: { id },
    });
  }
}
