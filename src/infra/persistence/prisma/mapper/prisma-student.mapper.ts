import {
  Student as PrismaStudent,
  StudentWithPhase as PrismaStudentWithPhase,
  Class as PrismaClass,
  Guardian as PrismaGuardian,
  GuardianRelationship as PrismaGuardianRelationship,
  GuardianStudent as PrismaGuardianStudent,
  Prisma,
} from "@prisma/client";
import { Student } from "@/domain/user-management/entities/student.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { StudentPhase } from "@/domain/user-management/enums/student-phase.enum";

/**
 * Mapper accepts rows from either the raw `student` table (no `phase`) or the
 * `student_with_phase` view (`phase: string`). Optional relation bags
 * (`guardians`, `class`) are loaded by callers but intentionally NOT projected
 * onto the domain entity — `StudentProps` has no `guardians` field; guardian
 * data is fetched on demand via `StudentRepository.getStudentGuardians`.
 */
type PrismaStudentRow = (PrismaStudent | PrismaStudentWithPhase) & {
  class?: PrismaClass | null;
  guardians?: Array<
    PrismaGuardianStudent & {
      guardian: PrismaGuardian;
      guardianRelationship: PrismaGuardianRelationship;
    }
  >;
};

export class PrismaStudentMapper {
  static toDomain(prismaStudent: PrismaStudentRow): Student {
    return Student.create(
      {
        campusId: prismaStudent.campusId,
        studentCode: prismaStudent.studentCode,
        fullName: prismaStudent.fullName,
        email: prismaStudent.email,
        phoneNumber: prismaStudent.phoneNumber,
        address: prismaStudent.address,
        dateOfBirth: prismaStudent.dateOfBirth,
        nickname: prismaStudent.nickname,
        gender: prismaStudent.gender as Gender | null,
        isArchived: prismaStudent.isArchived,
        phase: PrismaStudentMapper.extractPhase(prismaStudent),
        createdAt: prismaStudent.createdAt,
        updatedAt: prismaStudent.updatedAt,
      },
      prismaStudent.id,
    );
  }

  static toDomainSimple(
    prismaStudent: PrismaStudent | PrismaStudentWithPhase,
  ): Student {
    return Student.create(
      {
        campusId: prismaStudent.campusId,
        studentCode: prismaStudent.studentCode,
        fullName: prismaStudent.fullName,
        email: prismaStudent.email,
        phoneNumber: prismaStudent.phoneNumber,
        address: prismaStudent.address,
        dateOfBirth: prismaStudent.dateOfBirth,
        nickname: prismaStudent.nickname,
        gender: prismaStudent.gender as Gender | null,
        isArchived: prismaStudent.isArchived,
        phase: PrismaStudentMapper.extractPhase(prismaStudent),
        createdAt: prismaStudent.createdAt,
        updatedAt: prismaStudent.updatedAt,
      },
      prismaStudent.id,
    );
  }

  static toPrisma(student: Student): Prisma.StudentUncheckedCreateInput {
    return {
      id: student.id,
      campusId: student.campusId,
      studentCode: student.studentCode,
      fullName: student.fullName,
      email: student.email,
      phoneNumber: student.phoneNumber,
      address: student.address,
      dateOfBirth: student.dateOfBirth,
      nickname: student.nickname,
      gender: student.gender,
      isArchived: student.isArchived,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
    };
  }

  static toPrismaUpdate(student: Student): Prisma.StudentUpdateInput {
    // campusId and studentCode are intentionally omitted - both are immutable after creation.
    return {
      fullName: student.fullName,
      email: student.email,
      phoneNumber: student.phoneNumber,
      address: student.address,
      dateOfBirth: student.dateOfBirth,
      nickname: student.nickname,
      gender: student.gender,
      isArchived: student.isArchived,
      updatedAt: student.updatedAt,
    };
  }

  static toDomainArray(prismaStudents: PrismaStudentRow[]): Student[] {
    return prismaStudents.map((prismaStudent) =>
      PrismaStudentMapper.toDomain(prismaStudent),
    );
  }

  /**
   * Returns the view-projected `phase` when reading from `student_with_phase`,
   * or `undefined` for raw-table rows (post-create/update writes). Spec
   * @doc/specs/student-status-simplification AC-15.
   */
  private static extractPhase(
    row: PrismaStudent | PrismaStudentWithPhase,
  ): StudentPhase | undefined {
    return "phase" in row ? (row.phase as StudentPhase) : undefined;
  }
}
