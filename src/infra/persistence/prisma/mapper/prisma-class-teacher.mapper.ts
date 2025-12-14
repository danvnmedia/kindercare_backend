import {
  ClassTeacher as PrismaClassTeacher,
  Class as PrismaClass,
  Teacher as PrismaTeacher,
  Subject as PrismaSubject,
} from "@prisma/client";
import { ClassTeacher } from "@/domain/class-management/entities/class-teacher.entity";
import { Prisma } from "@prisma/client";
import { PrismaClassMapper } from "./prisma-class.mapper";
import { PrismaTeacherMapper } from "./prisma-teacher.mapper";
import { PrismaSubjectMapper } from "./prisma-subject.mapper";

type PrismaClassTeacherWithRelations = PrismaClassTeacher & {
  class?: PrismaClass | null;
  teacher?: PrismaTeacher | null;
  subject?: PrismaSubject | null;
};

export class PrismaClassTeacherMapper {
  static toDomain(prismaClassTeacher: PrismaClassTeacherWithRelations): ClassTeacher {
    const props: any = {
      classId: prismaClassTeacher.classId,
      teacherId: prismaClassTeacher.teacherId,
      subjectId: prismaClassTeacher.subjectId,
      createdAt: prismaClassTeacher.createdAt,
      updatedAt: prismaClassTeacher.updatedAt,
    };

    // Map relations if they exist
    if (prismaClassTeacher.class) {
      props.class = PrismaClassMapper.toDomainSimple(prismaClassTeacher.class);
    }
    if (prismaClassTeacher.teacher) {
      props.teacher = PrismaTeacherMapper.toDomainSimple(prismaClassTeacher.teacher);
    }
    if (prismaClassTeacher.subject) {
      props.subject = PrismaSubjectMapper.toDomain(prismaClassTeacher.subject);
    }

    const compositeId = `${prismaClassTeacher.classId}-${prismaClassTeacher.teacherId}-${prismaClassTeacher.subjectId}`;
    return ClassTeacher.create(props, compositeId);
  }

  static toDomainSimple(prismaClassTeacher: PrismaClassTeacher): ClassTeacher {
    const compositeId = `${prismaClassTeacher.classId}-${prismaClassTeacher.teacherId}-${prismaClassTeacher.subjectId}`;
    return ClassTeacher.create(
      {
        classId: prismaClassTeacher.classId,
        teacherId: prismaClassTeacher.teacherId,
        subjectId: prismaClassTeacher.subjectId,
        createdAt: prismaClassTeacher.createdAt,
        updatedAt: prismaClassTeacher.updatedAt,
      },
      compositeId,
    );
  }

  static toPrisma(classTeacher: ClassTeacher): Prisma.ClassTeacherUncheckedCreateInput {
    return {
      classId: classTeacher.classId,
      teacherId: classTeacher.teacherId,
      subjectId: classTeacher.subjectId,
      createdAt: classTeacher.createdAt,
      updatedAt: classTeacher.updatedAt,
    };
  }

  static toDomainArray(prismaClassTeachers: PrismaClassTeacherWithRelations[]): ClassTeacher[] {
    return prismaClassTeachers.map((ct) => PrismaClassTeacherMapper.toDomain(ct));
  }
}
