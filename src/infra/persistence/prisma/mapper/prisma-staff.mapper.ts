import {
  Prisma,
  Staff as PrismaStaff,
  StaffStaffType as PrismaStaffStaffType,
  StaffType as PrismaStaffType,
  User as PrismaUser,
} from "@prisma/client";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";

/**
 * Shape returned by repository queries that eager-load the
 * `staff_staff_type` join with its target `staffType` row. The mapper walks
 * this collection, sorts by `StaffType.order` ASC, and projects each row to a
 * `StaffTypeSnapshot`. See @doc/specs/staff-multi-type-refactor#technical-notes.
 */
type PrismaStaffWithRelations = PrismaStaff & {
  user?: PrismaUser | null;
  staffTypes?: Array<PrismaStaffStaffType & { staffType: PrismaStaffType }>;
};

export class PrismaStaffMapper {
  static toDomain(prismaStaff: PrismaStaffWithRelations): Staff {
    // Walk the eager-loaded join collection. Defensively filter rows whose
    // `staffType` is absent (e.g. relation not eager-loaded on a stale shape)
    // and sort by `StaffType.order` ASC so the read-side projection is stable
    // regardless of insertion order in `staff_staff_type`.
    const sortedJoins = (prismaStaff.staffTypes ?? [])
      .filter((join) => join.staffType !== null && join.staffType !== undefined)
      .sort((a, b) => (a.staffType.order ?? 0) - (b.staffType.order ?? 0));

    const staffProps = {
      campusId: prismaStaff.campusId,
      staffCode: prismaStaff.staffCode,
      fullName: prismaStaff.fullName,
      email: prismaStaff.email,
      phoneNumber: prismaStaff.phoneNumber,
      // Narrow read-side snapshot — see StaffTypeSnapshot in staff.entity.ts.
      staffTypes: sortedJoins.map((join) => ({
        id: join.staffType.id,
        name: join.staffType.name,
      })),
      address: prismaStaff.address,
      dateOfBirth: prismaStaff.dateOfBirth,
      gender: prismaStaff.gender as Gender | null,
      userId: prismaStaff.userId,
      isArchived: prismaStaff.isArchived,
      createdAt: prismaStaff.createdAt,
      updatedAt: prismaStaff.updatedAt,
    };

    return Staff.create(staffProps, prismaStaff.id);
  }

  /**
   * Hydrate a Staff without the `staff_staff_type` join eager-loaded.
   * `staffTypes` is `[]`; callers that need the collection must use
   * `toDomain` against a query that eager-loads
   * `staffTypes: { include: { staffType: true } }`.
   */
  static toDomainSimple(prismaStaff: PrismaStaff): Staff {
    const staffProps = {
      campusId: prismaStaff.campusId,
      staffCode: prismaStaff.staffCode,
      fullName: prismaStaff.fullName,
      email: prismaStaff.email,
      phoneNumber: prismaStaff.phoneNumber,
      staffTypes: [],
      address: prismaStaff.address,
      dateOfBirth: prismaStaff.dateOfBirth,
      gender: prismaStaff.gender as Gender | null,
      userId: prismaStaff.userId,
      isArchived: prismaStaff.isArchived,
      createdAt: prismaStaff.createdAt,
      updatedAt: prismaStaff.updatedAt,
    };

    return Staff.create(staffProps, prismaStaff.id);
  }

  static toPrisma(staff: Staff): Prisma.StaffUncheckedCreateInput {
    // StaffType assignments live in `staff_staff_type` and are written by the
    // use-case via `tx.replaceStaffTypes` — never from the mapper.
    return {
      id: staff.id,
      campusId: staff.campusId,
      staffCode: staff.staffCode,
      fullName: staff.fullName,
      email: staff.email,
      phoneNumber: staff.phoneNumber,
      address: staff.address,
      dateOfBirth: staff.dateOfBirth,
      gender: staff.gender,
      userId: staff.userId,
      isArchived: staff.isArchived,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
    };
  }

  static toPrismaUpdate(staff: Staff): Prisma.StaffUpdateInput {
    // staffCode is intentionally omitted - it is immutable after creation.
    // StaffType set updates go through `tx.replaceStaffTypes` — the mapper
    // does not touch the `staff_staff_type` join here.
    const updateData: Prisma.StaffUpdateInput = {
      fullName: staff.fullName,
      email: staff.email,
      phoneNumber: staff.phoneNumber,
      address: staff.address,
      dateOfBirth: staff.dateOfBirth,
      gender: staff.gender,
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

  static toDomainArray(prismaStaffs: PrismaStaffWithRelations[]): Staff[] {
    return prismaStaffs.map((prismaStaff) =>
      PrismaStaffMapper.toDomain(prismaStaff),
    );
  }
}
