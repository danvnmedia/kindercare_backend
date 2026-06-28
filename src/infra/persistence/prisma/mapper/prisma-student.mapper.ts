import {
  Student as PrismaStudent,
  StudentWithPhase as PrismaStudentWithPhase,
  Guardian as PrismaGuardian,
  GuardianRelationship as PrismaGuardianRelationship,
  GuardianStudent as PrismaGuardianStudent,
  Prisma,
} from "@prisma/client";
import {
  ClassSnapshot,
  Student,
} from "@/domain/user-management/entities/student.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { StudentPhase } from "@/domain/user-management/enums/student-phase.enum";

/**
 * Mapper accepts rows from either the raw `student` table (no derived
 * columns) or the `student_with_phase` view (`phase`, `currentClassId`,
 * `currentClassName`). Optional `guardians` relation bag is loaded by callers
 * but intentionally NOT projected onto the domain entity — guardian data is
 * fetched on demand via `StudentRepository.getStudentGuardians`.
 */
type PrismaStudentRow = (PrismaStudent | PrismaStudentWithPhase) & {
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
        currentClass: PrismaStudentMapper.extractCurrentClass(prismaStudent),
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
        currentClass: PrismaStudentMapper.extractCurrentClass(prismaStudent),
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

  /**
   * Returns the view-projected currently-open enrollment's class as a
   * read-only `{ id, name }` snapshot when reading from `student_with_phase`,
   * or `null` for raw-table rows (post-create/update writes). The SQL view
   * guarantees `currentClassName` is non-null whenever `currentClassId` is
   * non-null (LEFT JOIN to `class` PK + NOT NULL on `class.name`).
   * Spec @doc/specs/student-current-class-surfacing FR-8.
   */
  private static extractCurrentClass(
    row: PrismaStudent | PrismaStudentWithPhase,
  ): ClassSnapshot | null {
    if ("currentClassId" in row && row.currentClassId !== null) {
      return {
        id: row.currentClassId,
        name: row.currentClassName ?? "",
      };
    }
    return null;
  }
}
