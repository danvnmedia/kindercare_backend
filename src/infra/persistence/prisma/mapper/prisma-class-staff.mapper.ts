import {
  ClassStaff as PrismaClassStaff,
  Class as PrismaClass,
  Staff as PrismaStaff,
  Prisma,
} from "@prisma/client";
import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";
import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";
import { PrismaClassMapper } from "./prisma-class.mapper";
import { PrismaStaffMapper } from "./prisma-staff.mapper";

type PrismaClassStaffWithRelations = PrismaClassStaff & {
  class?: PrismaClass | null;
  staff?: PrismaStaff | null;
};

export class PrismaClassStaffMapper {
  static toDomain(prismaClassStaff: PrismaClassStaffWithRelations): ClassStaff {
    const compositeId = `${prismaClassStaff.classId}-${prismaClassStaff.staffId}`;
    return ClassStaff.create(
      {
        classId: prismaClassStaff.classId,
        staffId: prismaClassStaff.staffId,
        role: prismaClassStaff.role as ClassStaffRole,
        class: prismaClassStaff.class
          ? PrismaClassMapper.toDomainSimple(prismaClassStaff.class)
          : undefined,
        staff: prismaClassStaff.staff
          ? PrismaStaffMapper.toDomainSimple(prismaClassStaff.staff)
          : undefined,
        createdAt: prismaClassStaff.createdAt,
        updatedAt: prismaClassStaff.updatedAt,
      },
      compositeId,
    );
  }

  static toDomainSimple(prismaClassStaff: PrismaClassStaff): ClassStaff {
    const compositeId = `${prismaClassStaff.classId}-${prismaClassStaff.staffId}`;
    return ClassStaff.create(
      {
        classId: prismaClassStaff.classId,
        staffId: prismaClassStaff.staffId,
        role: prismaClassStaff.role as ClassStaffRole,
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
      role: classStaff.role,
      createdAt: classStaff.createdAt,
      updatedAt: classStaff.updatedAt,
    };
  }

  /**
   * Update input for role mutations. `role` is an enum column (not an FK),
   * so the regular `UpdateInput` shape is correct — the `UncheckedUpdateInput`
   * escape hatch only matters when raw FK columns must be assigned (see
   * @doc/patterns/mapper-pattern). Identity columns (classId, staffId) are
   * intentionally omitted because they are immutable after creation.
   */
  static toPrismaUpdate(
    classStaff: ClassStaff,
  ): Prisma.ClassStaffUpdateInput {
    return {
      role: classStaff.role,
      updatedAt: classStaff.updatedAt,
    };
  }

  static toDomainArray(
    prismaClassStaffs: PrismaClassStaffWithRelations[],
  ): ClassStaff[] {
    return prismaClassStaffs.map((cs) => PrismaClassStaffMapper.toDomain(cs));
  }
}
