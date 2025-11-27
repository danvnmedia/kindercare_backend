import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StudentRepository } from '@/application/user-management/ports/student.repository';
import { Student } from '@/domain/user-management/student.entity';
import { PrismaStudentMapper } from '../mapper/prisma-student.mapper';
import { StandardRequest } from '@/core/modules/standard-response/dto/standard-request.dto';
import { PaginatedResult } from '@/core/modules/standard-response/dto/query.dto';
import { PrismaQueryService } from '@/core/modules/standard-response/services/prisma-query.service';

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
        class: true,
        parents: {
          include: {
            parent: true,
            parentRelationship: true,
          },
        },
      },
    });
    return prismaStudent ? PrismaStudentMapper.toDomain(prismaStudent) : null;
  }

  async findByEmail(email: string): Promise<Student | null> {
    const prismaStudent = await this.prisma.student.findFirst({
      where: { email },
      include: {
        class: true,
      },
    });
    return prismaStudent ? PrismaStudentMapper.toDomain(prismaStudent) : null;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Student | null> {
    const prismaStudent = await this.prisma.student.findFirst({
      where: { phoneNumber },
      include: {
        class: true,
      },
    });
    return prismaStudent ? PrismaStudentMapper.toDomain(prismaStudent) : null;
  }

  async findByIds(ids: string[]): Promise<Student[]> {
    const prismaStudents = await this.prisma.student.findMany({
      where: { id: { in: ids } },
      include: {
        class: true,
      },
    });
    return prismaStudents.map(PrismaStudentMapper.toDomain);
  }

  async findAll(params: StandardRequest): Promise<PaginatedResult<Student>> {
    // Define allowed fields for filtering and sorting
    params.allowedFilterFields = [
      'fullName',
      'email',
      'phoneNumber',
      'classId',
      'gender',
      'isOnTrack',
      'nickname',
      'enrollmentDate',
      'isArchived',
    ];
    params.allowedSortFields = [
      'createdAt',
      'updatedAt',
      'enrollmentDate',
      'nickname',
      'fullName',
    ];

    // Use PrismaQueryService to execute query with StandardRequest
    return await this.queryService.executeQuery<Student>(
      this.prisma,
      'student',
      params,
      {
        include: {
          class: true,
        },
      },
      PrismaStudentMapper,
    );
  }

  async countByClassId(classId: string): Promise<number> {
    return await this.prisma.student.count({
      where: { classId },
    });
  }

  async save(
    student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Student> {
    const prismaData = PrismaStudentMapper.toPrismaCreate(student);
    const created = await this.prisma.student.create({
      data: prismaData,
      include: {
        class: true,
      },
    });
    return PrismaStudentMapper.toDomain(created);
  }

  async update(id: string, data: Partial<Student>): Promise<Student> {
    const prismaData = PrismaStudentMapper.toPrismaUpdate(data);
    const updated = await this.prisma.student.update({
      where: { id },
      data: prismaData,
      include: {
        class: true,
      },
    });
    return PrismaStudentMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.student.delete({
      where: { id },
    });
  }

  async assignParents(
    studentId: string,
    parentRelations: Array<{ parentId: string; relationshipId: string }>,
  ): Promise<void> {
    await this.prisma.studentParent.createMany({
      data: parentRelations.map((relation) => ({
        studentId,
        parentId: relation.parentId,
        parentRelationshipId: relation.relationshipId,
      })),
      skipDuplicates: true, // Skip if relationship already exists
    });
  }

  async removeParents(studentId: string, parentIds: string[]): Promise<void> {
    await this.prisma.studentParent.deleteMany({
      where: {
        studentId,
        parentId: { in: parentIds },
      },
    });
  }

  async getStudentParents(studentId: string): Promise<any[]> {
    const studentParents = await this.prisma.studentParent.findMany({
      where: { studentId },
      include: {
        parent: true,
        parentRelationship: true,
      },
    });

    return studentParents.map((sp) => ({
      parentId: sp.parent.id,
      fullName: sp.parent.fullName,
      email: sp.parent.email,
      phoneNumber: sp.parent.phoneNumber,
      relationship: sp.parentRelationship.id,
      relationshipName: sp.parentRelationship.name,
    }));
  }
}
