import {
  ClassStaff as PrismaClassStaff,
  Class as PrismaClass,
  Staff as PrismaStaff,
  Subject as PrismaSubject,
} from "@prisma/client";
import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";
import { Prisma } from "@prisma/client";
import { PrismaClassMapper } from "./prisma-class.mapper";
import { PrismaStaffMapper } from "./prisma-staff.mapper";
import { PrismaSubjectMapper } from "./prisma-subject.mapper";

type PrismaClassStaffWithRelations = PrismaClassStaff & {
  class?: PrismaClass | null;
  staff?: PrismaStaff | null;
  subject?: PrismaSubject | null;
};

export class PrismaClassStaffMapper {
  static toDomain(
    prismaClassStaff: PrismaClassStaffWithRelations,
  ): ClassStaff {
    const props: any = {
      classId: prismaClassStaff.classId,
      staffId: prismaClassStaff.staffId,
      subjectId: prismaClassStaff.subjectId,
      createdAt: prismaClassStaff.createdAt,
      updatedAt: prismaClassStaff.updatedAt,
    };

    // Map relations if they exist
    if (prismaClassStaff.class) {
      props.class = PrismaClassMapper.toDomainSimple(prismaClassStaff.class);
    }
    if (prismaClassStaff.staff) {
      props.staff = PrismaStaffMapper.toDomainSimple(
        prismaClassStaff.staff,
      );
    }
    if (prismaClassStaff.subject) {
      props.subject = PrismaSubjectMapper.toDomain(prismaClassStaff.subject);
    }

    const compositeId = `${prismaClassStaff.classId}-${prismaClassStaff.staffId}-${prismaClassStaff.subjectId}`;
    return ClassStaff.create(props, compositeId);
  }

  static toDomainSimple(prismaClassStaff: PrismaClassStaff): ClassStaff {
    const compositeId = `${prismaClassStaff.classId}-${prismaClassStaff.staffId}-${prismaClassStaff.subjectId}`;
    return ClassStaff.create(
      {
        classId: prismaClassStaff.classId,
        staffId: prismaClassStaff.staffId,
        subjectId: prismaClassStaff.subjectId,
        createdAt: prismaClassStaff.createdAt,
        updatedAt: prismaClassStaff.updatedAt,
      },
      compositeId,
    );
  }

  static toPrisma(
    classStaff: ClassStaff,
  ): Prisma.ClassStaffUncheckedCreateInput {
    return {
      classId: classStaff.classId,
      staffId: classStaff.staffId,
      subjectId: classStaff.subjectId,
      createdAt: classStaff.createdAt,
      updatedAt: classStaff.updatedAt,
    };
  }

  static toDomainArray(
    prismaClassStaffs: PrismaClassStaffWithRelations[],
  ): ClassStaff[] {
    return prismaClassStaffs.map((ct) =>
      PrismaClassStaffMapper.toDomain(ct),
    );
  }
}
