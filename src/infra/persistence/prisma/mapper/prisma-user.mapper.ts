/**
 * Prisma User Mapper
 * Maps between Prisma User model and domain User entity
 *
 * NOTE: User only contains authentication info.
 * Personal info is stored directly in Guardian/Staff tables.
 */

import {
  User as PrismaUser,
  Role as PrismaRole,
  UserRole as PrismaUserRole,
  RolePermission as PrismaRolePermission,
  Permission as PrismaPermission,
  Guardian as PrismaGuardian,
  Staff as PrismaStaff,
} from "@prisma/client";
import {
  User,
  UserRoleAssignment,
  UserProfile,
} from "../../../../domain/user-management/user.entity";
import { Prisma } from "@prisma/client";
import { PrismaRoleMapper } from "./prisma-role.mapper";

/**
 * Type for UserRole with full role data including permissions
 */
type PrismaUserRoleWithRole = PrismaUserRole & {
  role: PrismaRole & {
    rolePermissions?: Array<
      PrismaRolePermission & {
        permission: PrismaPermission;
      }
    >;
  };
};

export class PrismaUserMapper {
  /**
   * Map guardian data to UserProfile
   */
  private static mapGuardianToProfile(guardian: PrismaGuardian): UserProfile {
    return {
      type: "guardian",
      id: guardian.id,
      fullName: guardian.fullName,
      email: guardian.email,
      phoneNumber: guardian.phoneNumber,
      dateOfBirth: guardian.dateOfBirth,
      gender: guardian.gender,
    };
  }

  /**
   * Map staff data to UserProfile
   */
  private static mapStaffToProfile(staff: PrismaStaff): UserProfile {
    return {
      type: "staff",
      id: staff.id,
      fullName: staff.fullName,
      email: staff.email,
      phoneNumber: staff.phoneNumber,
      dateOfBirth: staff.dateOfBirth,
      gender: staff.gender,
    };
  }

  /**
   * Convert Prisma model to Domain entity (full)
   * Supports eager-loaded roles with campus context
   */
  static toDomain(
    prismaUser: PrismaUser & {
      userRoles?: PrismaUserRoleWithRole[];
      guardians?: PrismaGuardian[];
      staffs?: PrismaStaff[];
    },
  ): User {
    const roleAssignments: UserRoleAssignment[] =
      prismaUser.userRoles?.map((ur) => ({
        role: PrismaRoleMapper.toDomain(ur.role),
        campusId: ur.campusId,
        assignedAt: ur.assignedAt,
      })) ?? [];

    // Determine profile: prefer staff over guardian if both exist
    // (staff typically means employee with more access)
    let profile: UserProfile | null = null;
    if (prismaUser.staffs && prismaUser.staffs.length > 0) {
      profile = this.mapStaffToProfile(prismaUser.staffs[0]);
    } else if (prismaUser.guardians && prismaUser.guardians.length > 0) {
      profile = this.mapGuardianToProfile(prismaUser.guardians[0]);
    }

    return User.reconstitute(
      {
        clerkUid: prismaUser.clerkUid,
        isActive: prismaUser.isActive,
        roleAssignments,
        profile,
        createdAt: prismaUser.createdAt,
        updatedAt: prismaUser.updatedAt,
      },
      prismaUser.id,
    );
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations)
   * Use to prevent circular references
   */
  static toDomainSimple(prismaUser: PrismaUser): User {
    return User.reconstitute(
      {
        clerkUid: prismaUser.clerkUid,
        isActive: prismaUser.isActive,
        roleAssignments: [],
        createdAt: prismaUser.createdAt,
        updatedAt: prismaUser.updatedAt,
      },
      prismaUser.id,
    );
  }

  /**
   * Convert Domain entity to Prisma create input
   */
  static toPrisma(user: User): Prisma.UserUncheckedCreateInput {
    return {
      id: user.id,
      clerkUid: user.clerkUid,
      isActive: user.isActive,
    };
  }

  /**
   * Convert Domain entity to Prisma update input
   */
  static toPrismaUpdate(user: User): Prisma.UserUpdateInput {
    const data: Prisma.UserUpdateInput = {
      isActive: user.isActive,
      updatedAt: user.updatedAt,
    };

    return data;
  }

  /**
   * Convert array of Prisma models to Domain entities
   */
  static toDomainArray(
    prismaUsers: (PrismaUser & {
      userRoles?: Array<
        PrismaUserRole & {
          role: PrismaRole;
        }
      >;
    })[],
  ): User[] {
    return prismaUsers.map((prismaUser) =>
      PrismaUserMapper.toDomain(prismaUser),
    );
  }
}
