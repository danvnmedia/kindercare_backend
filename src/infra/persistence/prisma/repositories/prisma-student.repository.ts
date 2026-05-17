import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { Student } from "@/domain/user-management/entities/student.entity";
import { PrismaStudentMapper } from "../mapper/prisma-student.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

/**
 * Reads target the `student_with_phase` Postgres view so `phase` is projected
 * into the domain entity at mapping time (Spec D7, AC-14). Writes still target
 * the raw `student` table — the view is read-only.
 */
@Injectable()
export class PrismaStudentRepository implements StudentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<Student | null> {
    const prismaStudent = await this.prisma.studentWithPhase.findUnique({
      where: { id },
    });
    return prismaStudent ? PrismaStudentMapper.toDomain(prismaStudent) : null;
  }

  async findByEmail(email: string): Promise<Student | null> {
    const prismaStudent = await this.prisma.studentWithPhase.findFirst({
      where: { email },
    });
    return prismaStudent ? PrismaStudentMapper.toDomain(prismaStudent) : null;
  }

  async findByEmailInCampus(
    campusId: string,
    email: string,
  ): Promise<Student | null> {
    const prismaStudent = await this.prisma.studentWithPhase.findFirst({
      where: { campusId, email },
    });
    return prismaStudent ? PrismaStudentMapper.toDomain(prismaStudent) : null;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Student | null> {
    const prismaStudent = await this.prisma.studentWithPhase.findFirst({
      where: { phoneNumber },
    });
    return prismaStudent ? PrismaStudentMapper.toDomain(prismaStudent) : null;
  }

  async findByPhoneNumberInCampus(
    campusId: string,
    phoneNumber: string,
  ): Promise<Student | null> {
    const prismaStudent = await this.prisma.studentWithPhase.findFirst({
      where: { campusId, phoneNumber },
    });
    return prismaStudent ? PrismaStudentMapper.toDomain(prismaStudent) : null;
  }

  async findByStudentCodeInCampus(
    campusId: string,
    studentCode: string,
  ): Promise<Student | null> {
    const prismaStudent = await this.prisma.studentWithPhase.findFirst({
      where: { campusId, studentCode },
    });
    return prismaStudent ? PrismaStudentMapper.toDomain(prismaStudent) : null;
  }

  async findByCampusId(campusId: string): Promise<Student[]> {
    const students = await this.prisma.studentWithPhase.findMany({
      where: { campusId },
    });
    return students.map(PrismaStudentMapper.toDomain);
  }

  async findByIds(ids: string[]): Promise<Student[]> {
    const prismaStudents = await this.prisma.studentWithPhase.findMany({
      where: { id: { in: ids } },
    });
    return prismaStudents.map(PrismaStudentMapper.toDomain);
  }

  async findAll(
    params: StandardRequest,
    scope?: Record<string, any>,
  ): Promise<PaginatedResult<Student>> {
    params.allowedFilterFields = [
      "campusId",
      "studentCode",
      "fullName",
      "email",
      "phoneNumber",
      "gender",
      "nickname",
      "isArchived",
      "dateOfBirth",
    ];
    params.allowedSortFields = [
      "createdAt",
      "updatedAt",
      "nickname",
      "studentCode",
      "fullName",
      "dateOfBirth",
    ];

    return await this.queryService.executeQuery<Student>(
      this.prisma,
      "studentWithPhase",
      params,
      {
        orderBy: { studentCode: "desc" },
        scope,
      },
      PrismaStudentMapper,
    );
  }

  async findEligibleForClass(
    _classId: string,
    params: StandardRequest,
    scope?: { campusId: string },
  ): Promise<PaginatedResult<Student>> {
    // Narrow user-controllable surface: caller can filter by fullName (ilike
    // for ?search) and studentCode. `status` is gone (Spec D9). isArchived,
    // open-enrollment NOT-EXISTS, and scope.campusId are system-enforced via
    // `where` + `scope` — phase narrowing is a client-side concern.
    params.allowedFilterFields = ["fullName", "studentCode"];
    params.allowedSortFields = [
      "fullName",
      "studentCode",
      "dateOfBirth",
      "createdAt",
    ];

    return await this.queryService.executeQuery<Student>(
      this.prisma,
      "studentWithPhase",
      params,
      {
        where: {
          isArchived: false,
          // NOT EXISTS active enrollment for this student in ANY class.
          enrollments: { none: { endDate: null } },
        },
        orderBy: { createdAt: "desc" },
        scope,
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
      skipDuplicates: true,
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

  async updateGuardianRelationship(
    studentId: string,
    guardianId: string,
    relationshipId: string,
  ): Promise<void> {
    await this.prisma.guardianStudent.update({
      where: { studentId_guardianId: { studentId, guardianId } },
      data: { guardianRelationshipId: relationshipId },
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
