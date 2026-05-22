import { StaffType as PrismaStaffType } from "@prisma/client";
import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { Prisma } from "@prisma/client";

export class PrismaStaffTypeMapper {
  static toDomain(prismaStaffType: PrismaStaffType): StaffType {
    return StaffType.create(
      {
        campusId: prismaStaffType.campusId,
        name: prismaStaffType.name,
        description: prismaStaffType.description,
        defaultRoleId: prismaStaffType.defaultRoleId,
        isArchived: prismaStaffType.isArchived,
        order: prismaStaffType.order,
        createdAt: prismaStaffType.createdAt,
        updatedAt: prismaStaffType.updatedAt,
      },
      prismaStaffType.id,
    );
  }

  static toPrisma(staffType: StaffType): Prisma.StaffTypeUncheckedCreateInput {
    return {
      id: staffType.id,
      campusId: staffType.campusId,
      name: staffType.name,
      description: staffType.description,
      defaultRoleId: staffType.defaultRoleId,
      isArchived: staffType.isArchived,
      order: staffType.order,
      createdAt: staffType.createdAt,
      updatedAt: staffType.updatedAt,
    };
  }

  static toPrismaUpdate(staffType: StaffType): Prisma.StaffTypeUpdateInput {
    const updateData: Prisma.StaffTypeUpdateInput = {
      name: staffType.name,
      description: staffType.description,
      isArchived: staffType.isArchived,
      order: staffType.order,
      updatedAt: staffType.updatedAt,
    };

    // Handle defaultRole relation update
    if (staffType.defaultRoleId) {
      updateData.defaultRole = { connect: { id: staffType.defaultRoleId } };
    } else {
      updateData.defaultRole = { disconnect: true };
    }

    return updateData;
  }

  static toDomainArray(prismaStaffTypes: PrismaStaffType[]): StaffType[] {
    return prismaStaffTypes.map((st) => PrismaStaffTypeMapper.toDomain(st));
  }
}
