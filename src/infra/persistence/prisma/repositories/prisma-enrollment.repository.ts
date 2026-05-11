import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { EnrollmentRepository } from "@/application/class-management/ports/enrollment.repository";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { PrismaEnrollmentMapper } from "../mapper/prisma-enrollment.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

@Injectable()
export class PrismaEnrollmentRepository implements EnrollmentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<Enrollment | null> {
    const prismaEnrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      include: {
        class: true,
        student: true,
      },
    });
    return prismaEnrollment
      ? PrismaEnrollmentMapper.toDomain(prismaEnrollment)
      : null;
  }

  async findByStudentClassDate(
    studentId: string,
    classId: string,
    enrollmentDate: Date,
  ): Promise<Enrollment | null> {
    const prismaEnrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        classId,
        enrollmentDate,
      },
      include: {
        class: true,
        student: true,
      },
    });
    return prismaEnrollment
      ? PrismaEnrollmentMapper.toDomain(prismaEnrollment)
      : null;
  }

  async findByClassId(classId: string): Promise<Enrollment[]> {
    const prismaEnrollments = await this.prisma.enrollment.findMany({
      where: { classId },
      include: {
        class: true,
        student: true,
      },
      orderBy: { enrollmentDate: "desc" },
    });
    return PrismaEnrollmentMapper.toDomainArray(prismaEnrollments);
  }

  async findByStudentId(studentId: string): Promise<Enrollment[]> {
    const prismaEnrollments = await this.prisma.enrollment.findMany({
      where: { studentId },
      include: {
        class: true,
        student: true,
      },
      orderBy: { enrollmentDate: "desc" },
    });
    return PrismaEnrollmentMapper.toDomainArray(prismaEnrollments);
  }

  async findActiveByStudentId(
    studentId: string,
  ): Promise<Enrollment | null> {
    const prismaEnrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, endDate: null },
      include: {
        class: true,
        student: true,
      },
    });
    return prismaEnrollment
      ? PrismaEnrollmentMapper.toDomain(prismaEnrollment)
      : null;
  }

  async findActiveByClassId(classId: string): Promise<Enrollment[]> {
    const prismaEnrollments = await this.prisma.enrollment.findMany({
      where: { classId, endDate: null },
      include: {
        class: true,
        student: true,
      },
      orderBy: { enrollmentDate: "desc" },
    });
    return PrismaEnrollmentMapper.toDomainArray(prismaEnrollments);
  }

  async findHistoricalByClassId(classId: string): Promise<Enrollment[]> {
    const prismaEnrollments = await this.prisma.enrollment.findMany({
      where: { classId },
      include: {
        class: true,
        student: true,
      },
      orderBy: { enrollmentDate: "desc" },
    });
    return PrismaEnrollmentMapper.toDomainArray(prismaEnrollments);
  }

  async findAllByStudentId(studentId: string): Promise<Enrollment[]> {
    const prismaEnrollments = await this.prisma.enrollment.findMany({
      where: { studentId },
      include: {
        class: {
          include: {
            schoolYear: true,
            gradeLevel: true,
          },
        },
        student: true,
      },
      orderBy: { enrollmentDate: "desc" },
    });
    return PrismaEnrollmentMapper.toDomainArray(prismaEnrollments);
  }

  async findAll(params: StandardRequest): Promise<PaginatedResult<Enrollment>> {
    params.allowedFilterFields = ["classId", "studentId", "enrollmentDate"];
    params.allowedSortFields = ["createdAt", "updatedAt", "enrollmentDate"];

    return await this.queryService.executeQuery<Enrollment>(
      this.prisma,
      "enrollment",
      params,
      {
        include: {
          class: true,
          student: true,
        },
      },
      PrismaEnrollmentMapper,
    );
  }

  async save(enrollment: Enrollment): Promise<Enrollment> {
    const prismaData = PrismaEnrollmentMapper.toPrisma(enrollment);
    const created = await this.prisma.enrollment.create({
      data: prismaData,
      include: {
        class: true,
        student: true,
      },
    });
    return PrismaEnrollmentMapper.toDomain(created);
  }

  async saveMany(enrollments: Enrollment[]): Promise<Enrollment[]> {
    return this.prisma.$transaction(async (tx) => {
      const results: Enrollment[] = [];
      for (const enrollment of enrollments) {
        const created = await tx.enrollment.create({
          data: PrismaEnrollmentMapper.toPrisma(enrollment),
          include: { class: true, student: true },
        });
        results.push(PrismaEnrollmentMapper.toDomain(created));
      }
      return results;
    });
  }

  async update(enrollment: Enrollment): Promise<Enrollment> {
    const prismaData = PrismaEnrollmentMapper.toPrismaUpdate(enrollment);
    const updated = await this.prisma.enrollment.update({
      where: { id: enrollment.id },
      data: prismaData,
      include: {
        class: true,
        student: true,
      },
    });
    return PrismaEnrollmentMapper.toDomain(updated);
  }

  async transferEnrollment(
    closed: Enrollment,
    opened: Enrollment,
  ): Promise<{ closed: Enrollment; opened: Enrollment }> {
    return this.prisma.$transaction(async (tx) => {
      const updatedRow = await tx.enrollment.update({
        where: { id: closed.id },
        data: PrismaEnrollmentMapper.toPrismaUpdate(closed),
        include: { class: true, student: true },
      });
      const createdRow = await tx.enrollment.create({
        data: PrismaEnrollmentMapper.toPrisma(opened),
        include: { class: true, student: true },
      });
      return {
        closed: PrismaEnrollmentMapper.toDomain(updatedRow),
        opened: PrismaEnrollmentMapper.toDomain(createdRow),
      };
    });
  }
}
