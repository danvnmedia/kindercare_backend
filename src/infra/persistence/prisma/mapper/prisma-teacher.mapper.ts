import { Teacher as PrismaTeacher, User as PrismaUser } from "@prisma/client";
import { Teacher } from "@/domain/user-management/entities/teacher.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { TeacherType } from "@/domain/user-management/enums/teacher-type.enum";
import { Prisma } from "@prisma/client";

type PrismaTeacherWithRelations = PrismaTeacher & {
  user?: PrismaUser | null;
};

export class PrismaTeacherMapper {
  static toDomain(prismaTeacher: PrismaTeacherWithRelations): Teacher {
    const teacherProps = {
      fullName: prismaTeacher.fullName,
      email: prismaTeacher.email,
      phoneNumber: prismaTeacher.phoneNumber,
      teacherType: prismaTeacher.teacherType as TeacherType,
      address: prismaTeacher.address,
      dateOfBirth: prismaTeacher.dateOfBirth,
      gender: prismaTeacher.gender as Gender | null,
      startDate: prismaTeacher.startDate,
      userId: prismaTeacher.userId,
      isArchived: prismaTeacher.isArchived,
      createdAt: prismaTeacher.createdAt,
      updatedAt: prismaTeacher.updatedAt,
    };

    return Teacher.create(teacherProps, prismaTeacher.id);
  }

  static toDomainSimple(prismaTeacher: PrismaTeacher): Teacher {
    const teacherProps = {
      fullName: prismaTeacher.fullName,
      email: prismaTeacher.email,
      phoneNumber: prismaTeacher.phoneNumber,
      teacherType: prismaTeacher.teacherType as TeacherType,
      address: prismaTeacher.address,
      dateOfBirth: prismaTeacher.dateOfBirth,
      gender: prismaTeacher.gender as Gender | null,
      startDate: prismaTeacher.startDate,
      userId: prismaTeacher.userId,
      isArchived: prismaTeacher.isArchived,
      createdAt: prismaTeacher.createdAt,
      updatedAt: prismaTeacher.updatedAt,
    };

    return Teacher.create(teacherProps, prismaTeacher.id);
  }

  static toPrisma(teacher: Teacher): Prisma.TeacherUncheckedCreateInput {
    return {
      id: teacher.id,
      fullName: teacher.fullName,
      email: teacher.email,
      phoneNumber: teacher.phoneNumber,
      teacherType: teacher.teacherType,
      address: teacher.address,
      dateOfBirth: teacher.dateOfBirth,
      gender: teacher.gender,
      startDate: teacher.startDate,
      userId: teacher.userId,
      isArchived: teacher.isArchived,
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt,
    };
  }

  static toPrismaUpdate(teacher: Teacher): Prisma.TeacherUpdateInput {
    const updateData: Prisma.TeacherUpdateInput = {
      fullName: teacher.fullName,
      email: teacher.email,
      phoneNumber: teacher.phoneNumber,
      teacherType: teacher.teacherType,
      address: teacher.address,
      dateOfBirth: teacher.dateOfBirth,
      gender: teacher.gender,
      startDate: teacher.startDate,
      isArchived: teacher.isArchived,
      updatedAt: teacher.updatedAt,
    };

    // Handle user relation update
    if (teacher.userId) {
      updateData.user = { connect: { id: teacher.userId } };
    } else {
      updateData.user = { disconnect: true };
    }

    return updateData;
  }

  static toDomainArray(
    prismaTeachers: PrismaTeacherWithRelations[],
  ): Teacher[] {
    return prismaTeachers.map((prismaTeacher) =>
      PrismaTeacherMapper.toDomain(prismaTeacher),
    );
  }
}
