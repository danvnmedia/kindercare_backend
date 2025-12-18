import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { Student } from "@/domain/user-management/entities/student.entity";
import { PrismaStudentMapper } from "../mapper/prisma-student.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

@Injectable()
export class PrismaStudentRepository implements StudentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<Student | null> {
    const prismaStudent = await this.prisma.student.findUnique({
      where: { id },
      include: {
        guardians: {
          include: {
            guardian: true,
            guardianRelationship: true,
          },
        },
      },
    });
    return prismaStudent ? PrismaStudentMapper.toDomain(prismaStudent) : null;
  }

  async findByEmail(email: string): Promise<Student | null> {
    const prismaStudent = await this.prisma.student.findFirst({
      where: { email },
    });
    return prismaStudent ? PrismaStudentMapper.toDomain(prismaStudent) : null;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Student | null> {
    const prismaStudent = await this.prisma.student.findFirst({
      where: { phoneNumber },
    });
    return prismaStudent ? PrismaStudentMapper.toDomain(prismaStudent) : null;
  }

  async findByIds(ids: string[]): Promise<Student[]> {
    const prismaStudents = await this.prisma.student.findMany({
      where: { id: { in: ids } },
    });
    return prismaStudents.map(PrismaStudentMapper.toDomain);
  }

  async findAll(params: StandardRequest): Promise<PaginatedResult<Student>> {
    // Define allowed fields for filtering and sorting
    params.allowedFilterFields = [
      "studentCode",
      "fullName",
      "email",
      "phoneNumber",
      "gender",
      "nickname",
      "isArchived",
      "dateOfBirth",
      "status",
    ];
    params.allowedSortFields = [
      "createdAt",
      "updatedAt",
      "nickname",
      "studentCode",
      "fullName",
      "dateOfBirth",
    ];

    // Use PrismaQueryService to execute query with StandardRequest
    return await this.queryService.executeQuery<Student>(
      this.prisma,
      "student",
      params,
      {
        include: {
          guardians: {
            include: {
              guardian: true,
              guardianRelationship: true,
            },
          },
        },
        orderBy: { studentCode: "desc" }, // Default sort: newest students first
      },
      PrismaStudentMapper,
    );
  }

  async save(student: Student): Promise<Student> {
    const prismaData = PrismaStudentMapper.toPrisma(student);
    const created = await this.prisma.student.create({
      data: prismaData,
    });
    return PrismaStudentMapper.toDomain(created);
  }

  async update(student: Student): Promise<Student> {
    const prismaData = PrismaStudentMapper.toPrismaUpdate(student);
    const updated = await this.prisma.student.update({
      where: { id: student.id },
      data: prismaData,
    });
    return PrismaStudentMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.student.delete({
      where: { id },
    });
  }

  async assignGuardians(
    studentId: string,
    guardianRelations: Array<{ guardianId: string; relationshipId: string }>,
  ): Promise<void> {
    await this.prisma.guardianStudent.createMany({
      data: guardianRelations.map((relation) => ({
        studentId,
        guardianId: relation.guardianId,
        guardianRelationshipId: relation.relationshipId,
      })),
      skipDuplicates: true, // Skip if relationship already exists
    });
  }

  async removeGuardians(
    studentId: string,
    guardianIds: string[],
  ): Promise<void> {
    await this.prisma.guardianStudent.deleteMany({
      where: {
        studentId,
        guardianId: { in: guardianIds },
      },
    });
  }

  async getStudentGuardians(studentId: string): Promise<any[]> {
    const studentGuardians = await this.prisma.guardianStudent.findMany({
      where: { studentId },
      include: {
        guardian: true,
        guardianRelationship: true,
      },
    });

    return studentGuardians.map((sg) => ({
      guardianId: sg.guardian.id,
      fullName: sg.guardian.fullName,
      email: sg.guardian.email,
      phoneNumber: sg.guardian.phoneNumber,
      relationship: sg.guardianRelationship.id,
      relationshipName: sg.guardianRelationship.name,
    }));
  }
}
