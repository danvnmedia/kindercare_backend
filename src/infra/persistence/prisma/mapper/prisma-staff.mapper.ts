import { Staff as PrismaStaff, User as PrismaUser } from "@prisma/client";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { StaffType } from "@/domain/user-management/enums/staff-type.enum";
import { Prisma } from "@prisma/client";

type PrismaStaffWithRelations = PrismaStaff & {
  user?: PrismaUser | null;
};

export class PrismaStaffMapper {
  static toDomain(prismaStaff: PrismaStaffWithRelations): Staff {
    const staffProps = {
      fullName: prismaStaff.fullName,
      email: prismaStaff.email,
      phoneNumber: prismaStaff.phoneNumber,
      staffType: prismaStaff.staffType as StaffType,
      address: prismaStaff.address,
      dateOfBirth: prismaStaff.dateOfBirth,
      gender: prismaStaff.gender as Gender | null,
      startDate: prismaStaff.startDate,
      userId: prismaStaff.userId,
      isArchived: prismaStaff.isArchived,
      createdAt: prismaStaff.createdAt,
      updatedAt: prismaStaff.updatedAt,
    };

    return Staff.create(staffProps, prismaStaff.id);
  }

  static toDomainSimple(prismaStaff: PrismaStaff): Staff {
    const staffProps = {
      fullName: prismaStaff.fullName,
      email: prismaStaff.email,
      phoneNumber: prismaStaff.phoneNumber,
      staffType: prismaStaff.staffType as StaffType,
      address: prismaStaff.address,
      dateOfBirth: prismaStaff.dateOfBirth,
      gender: prismaStaff.gender as Gender | null,
      startDate: prismaStaff.startDate,
      userId: prismaStaff.userId,
      isArchived: prismaStaff.isArchived,
      createdAt: prismaStaff.createdAt,
      updatedAt: prismaStaff.updatedAt,
    };

    return Staff.create(staffProps, prismaStaff.id);
  }

  static toPrisma(staff: Staff): Prisma.StaffUncheckedCreateInput {
    return {
      id: staff.id,
      fullName: staff.fullName,
      email: staff.email,
      phoneNumber: staff.phoneNumber,
      staffType: staff.staffType,
      address: staff.address,
      dateOfBirth: staff.dateOfBirth,
      gender: staff.gender,
      startDate: staff.startDate,
      userId: staff.userId,
      isArchived: staff.isArchived,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
    };
  }

  static toPrismaUpdate(staff: Staff): Prisma.StaffUpdateInput {
    const updateData: Prisma.StaffUpdateInput = {
      fullName: staff.fullName,
      email: staff.email,
      phoneNumber: staff.phoneNumber,
      staffType: staff.staffType,
      address: staff.address,
      dateOfBirth: staff.dateOfBirth,
      gender: staff.gender,
      startDate: staff.startDate,
      isArchived: staff.isArchived,
      updatedAt: staff.updatedAt,
    };

    // Handle user relation update
    if (staff.userId) {
      updateData.user = { connect: { id: staff.userId } };
    } else {
      updateData.user = { disconnect: true };
    }

    return updateData;
  }

  static toDomainArray(
    prismaStaffs: PrismaStaffWithRelations[],
  ): Staff[] {
    return prismaStaffs.map((prismaStaff) =>
      PrismaStaffMapper.toDomain(prismaStaff),
    );
  }
}
