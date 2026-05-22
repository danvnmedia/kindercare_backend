import {
  Staff as PrismaStaff,
  User as PrismaUser,
  StaffType as PrismaStaffType,
} from "@prisma/client";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { Prisma } from "@prisma/client";

type PrismaStaffWithRelations = PrismaStaff & {
  user?: PrismaUser | null;
  staffType?: PrismaStaffType | null;
};

export class PrismaStaffMapper {
  static toDomain(prismaStaff: PrismaStaffWithRelations): Staff {
    const staffProps = {
      campusId: prismaStaff.campusId,
      staffCode: prismaStaff.staffCode,
      fullName: prismaStaff.fullName,
      email: prismaStaff.email,
      phoneNumber: prismaStaff.phoneNumber,
      staffTypeId: prismaStaff.staffTypeId,
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
      campusId: prismaStaff.campusId,
      staffCode: prismaStaff.staffCode,
      fullName: prismaStaff.fullName,
      email: prismaStaff.email,
      phoneNumber: prismaStaff.phoneNumber,
      staffTypeId: prismaStaff.staffTypeId,
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
      campusId: staff.campusId,
      staffCode: staff.staffCode,
      fullName: staff.fullName,
      email: staff.email,
      phoneNumber: staff.phoneNumber,
      staffTypeId: staff.staffTypeId,
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
    // staffCode is intentionally omitted - it is immutable after creation.
    const updateData: Prisma.StaffUpdateInput = {
      fullName: staff.fullName,
      email: staff.email,
      phoneNumber: staff.phoneNumber,
      address: staff.address,
      dateOfBirth: staff.dateOfBirth,
      gender: staff.gender,
      startDate: staff.startDate,
      isArchived: staff.isArchived,
      updatedAt: staff.updatedAt,
    };

    // Handle staffType relation update
    if (staff.staffTypeId) {
      updateData.staffType = { connect: { id: staff.staffTypeId } };
    } else {
      updateData.staffType = { disconnect: true };
    }

    // Handle user relation update
    if (staff.userId) {
      updateData.user = { connect: { id: staff.userId } };
    } else {
      updateData.user = { disconnect: true };
    }

    return updateData;
  }

  static toDomainArray(prismaStaffs: PrismaStaffWithRelations[]): Staff[] {
    return prismaStaffs.map((prismaStaff) =>
      PrismaStaffMapper.toDomain(prismaStaff),
    );
  }
}
