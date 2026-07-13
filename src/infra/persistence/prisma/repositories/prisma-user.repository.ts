import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import {
  UserRepository,
  FindAllUsersParams,
  PaginatedUsers,
} from "@/application/user-management/ports/user.repository";
import { User, RoleAssignmentInput } from "@/domain/user-management";
import { Role } from "@/domain/user-management/role.entity";
import { PrismaUserMapper } from "../mapper/prisma-user.mapper";
import { PrismaRoleMapper } from "../mapper/prisma-role.mapper";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

/**
 * Include object for fetching users with roles and permissions
 * Reused across all user fetch methods
 */
const USER_WITH_ROLES_INCLUDE = {
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
  // Include guardian and staff profiles for /auth/me endpoint
  guardians: {
    where: { isArchived: false },
    orderBy: { createdAt: "asc" },
  },
  staffs: {
    where: { isArchived: false },
    orderBy: { createdAt: "asc" },
  },
} as const;

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<User | null> {
    const prismaUser = await this.prisma.user.findUnique({
      where: { id },
      include: USER_WITH_ROLES_INCLUDE,
    });
    return prismaUser ? PrismaUserMapper.toDomain(prismaUser) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    // NOTE: Email is now stored in Guardian/Staff tables, not User table
    // Find user by guardian.email or staff.email relationship
    const prismaUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          {
            guardians: {
              some: { email: email },
            },
          },
          {
            staffs: {
              some: { email: email },
            },
          },
        ],
      },
      include: USER_WITH_ROLES_INCLUDE,
    });
    return prismaUser ? PrismaUserMapper.toDomain(prismaUser) : null;
  }

  async findManyByEmail(email: string): Promise<User[]> {
    const prismaUsers = await this.prisma.user.findMany({
      where: {
        OR: [
          {
            guardians: {
              some: { email },
            },
          },
          {
            staffs: {
              some: { email },
            },
          },
        ],
      },
      include: USER_WITH_ROLES_INCLUDE,
    });

    return prismaUsers.map((user) => PrismaUserMapper.toDomain(user));
  }

  async findManyByPhoneNumber(phoneNumber: string): Promise<User[]> {
    const prismaUsers = await this.prisma.user.findMany({
      where: {
        OR: [
          {
            guardians: {
              some: { phoneNumber },
            },
          },
          {
            staffs: {
              some: { phoneNumber },
            },
          },
        ],
      },
      include: USER_WITH_ROLES_INCLUDE,
    });

    return prismaUsers.map((user) => PrismaUserMapper.toDomain(user));
  }

  async findByClerkUid(clerkUid: string): Promise<User | null> {
    const prismaUser = await this.prisma.user.findUnique({
      where: { clerkUid },
      include: USER_WITH_ROLES_INCLUDE,
    });
    return prismaUser ? PrismaUserMapper.toDomain(prismaUser) : null;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }

    const prismaUsers = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      include: USER_WITH_ROLES_INCLUDE,
    });

    return prismaUsers.map((user) => PrismaUserMapper.toDomain(user));
  }

  async findAll(params: FindAllUsersParams): Promise<PaginatedUsers> {
    params.allowedFilterFields = ["isActive"];
    params.allowedSortFields = ["createdAt"];

    return await this.queryService.executeQuery<User>(
      this.prisma,
      "user",
      params,
      {
        include: USER_WITH_ROLES_INCLUDE,
      },
      PrismaUserMapper,
    );
  }

  async save(user: User): Promise<User> {
    const prismaData = PrismaUserMapper.toPrisma(user);
    const created = await this.prisma.user.create({
      data: prismaData,
      include: USER_WITH_ROLES_INCLUDE,
    });
    return PrismaUserMapper.toDomain(created);
  }

  async update(user: User): Promise<User> {
    const prismaData = PrismaUserMapper.toPrismaUpdate(user);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: prismaData,
      include: USER_WITH_ROLES_INCLUDE,
    });
    return PrismaUserMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
  }

  async assignRoles(
    userId: string,
    roleAssignments: RoleAssignmentInput[],
  ): Promise<void> {
    await this.prisma.userRole.createMany({
      data: roleAssignments.map((assignment) => ({
        userId,
        roleId: assignment.roleId,
        campusId: assignment.campusId ?? null, // null for global assignment
      })),
      skipDuplicates: true,
    });
  }

  async removeRoles(
    userId: string,
    roleAssignments: RoleAssignmentInput[],
  ): Promise<void> {
    // Delete each role assignment individually to match the exact campusId
    // Cannot use deleteMany with OR on composite conditions reliably
    for (const assignment of roleAssignments) {
      await this.prisma.userRole.deleteMany({
        where: {
          userId,
          roleId: assignment.roleId,
          campusId: assignment.campusId ?? null,
        },
      });
    }
  }

  async getUserRoles(
    userId: string,
    page: number,
    limit: number,
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const [roles, total] = await Promise.all([
      this.prisma.userRole.findMany({
        where: {
          userId,
        },
        skip,
        take: limit,
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      }),
      this.prisma.userRole.count({
        where: { userId },
      }),
    ]);

    return {
      data: roles.map((item) => ({
        ...item.role,
        assignmentCampusId: item.campusId, // Include the campus context of the assignment
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserRolesForCampus(
    userId: string,
    campusId: string | null,
  ): Promise<Role[]> {
    // Get roles that are:
    // 1. Assigned globally (campusId = null) - these apply everywhere
    // 2. Assigned specifically to this campus (campusId = campusId)
    const whereCondition =
      campusId === null
        ? { userId, campusId: null } // Only global roles
        : { userId, OR: [{ campusId: null }, { campusId }] }; // Global + campus-specific

    const userRoles = await this.prisma.userRole.findMany({
      where: whereCondition,
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    return userRoles.map((ur) => PrismaRoleMapper.toDomain(ur.role));
  }
}
