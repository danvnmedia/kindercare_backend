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
        isActive: prismaStaffType.isActive,
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
      isActive: staffType.isActive,
      createdAt: staffType.createdAt,
      updatedAt: staffType.updatedAt,
    };
  }

  static toPrismaUpdate(staffType: StaffType): Prisma.StaffTypeUpdateInput {
    const updateData: Prisma.StaffTypeUpdateInput = {
      name: staffType.name,
      description: staffType.description,
      isActive: staffType.isActive,
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
