import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import {
  RoleRepository,
  FindAllRolesOptions,
  RoleMember,
  RoleMemberProfile,
  PaginatedRoles,
  PaginatedRoleMembers,
  STAFF_CAMPUS_ACCESS_ROLE_DESCRIPTION,
  STAFF_CAMPUS_ACCESS_ROLE_NAME,
} from "../../../../application/user-management/ports/role.repository";
import {
  Role,
  CreateRoleData,
  UpdateRoleData,
} from "../../../../domain/user-management/role.entity";
import { Permission } from "@/domain/rbac";
import { PrismaRoleMapper } from "../mapper/prisma-role.mapper";
import { PrismaPermissionMapper } from "../mapper/prisma-permission.mapper";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { Prisma } from "@prisma/client";

const ROLE_WITH_PERMISSIONS_INCLUDE = {
  rolePermissions: {
    include: {
      permission: true,
    },
  },
} as const;

const STAFF_TYPE_PROVENANCE_WARNING =
  "This grant came from a StaffType default role. Revoking it here removes the current tracked grant, but future staff-type changes may grant it again if that StaffType still defaults to this role.";

@Injectable()
export class PrismaRoleRepository implements RoleRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<Role | null> {
    const prismaRole = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return prismaRole ? PrismaRoleMapper.toDomain(prismaRole) : null;
  }

  async findByName(
    name: string,
    campusId: string | null,
  ): Promise<Role | null> {
    const prismaRole = await this.prisma.role.findFirst({
      where: {
        name,
        campusId,
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return prismaRole ? PrismaRoleMapper.toDomain(prismaRole) : null;
  }

  async ensureCampusAccessRole(campusId: string): Promise<Role> {
    const prismaRole = await this.prisma.role.upsert({
      where: {
        campusId_name: {
          campusId,
          name: STAFF_CAMPUS_ACCESS_ROLE_NAME,
        },
      },
      update: {},
      create: {
        campusId,
        name: STAFF_CAMPUS_ACCESS_ROLE_NAME,
        description: STAFF_CAMPUS_ACCESS_ROLE_DESCRIPTION,
        isSystemDefault: true,
        isSystemRole: false,
      },
      include: ROLE_WITH_PERMISSIONS_INCLUDE,
    });

    const role = PrismaRoleMapper.toDomain(prismaRole);
    const isManagedPermissionlessRole =
      role.description === STAFF_CAMPUS_ACCESS_ROLE_DESCRIPTION &&
      role.isSystemDefault === true &&
      role.isSystemRole === false &&
      role.permissions.length === 0;

    if (!isManagedPermissionlessRole) {
      throw new ConflictException(
        `Reserved role name "${STAFF_CAMPUS_ACCESS_ROLE_NAME}" is already used by an unmanaged or permission-bearing role`,
      );
    }

    return role;
  }

  async findAll(
    params: StandardRequest,
    options: FindAllRolesOptions = {},
  ): Promise<PaginatedRoles> {
    params.allowedFilterFields = [
      "name",
      "description",
      "campusId",
      "isSystemDefault",
      "isSystemRole",
    ];
    params.allowedSortFields = ["createdAt", "name"];

    const where: Prisma.RoleWhereInput = {};
    if (options.onlySystemRoles) {
      where.campusId = null;
    } else if (options.campusId) {
      where.OR = options.includeSystemRoles
        ? [{ campusId: options.campusId }, { campusId: null }]
        : [{ campusId: options.campusId }];
    }

    return await this.queryService.executeQuery<Role>(
      this.prisma,
      "role",
      params,
      {
        where,
        include: ROLE_WITH_PERMISSIONS_INCLUDE,
      },
      PrismaRoleMapper,
    );
  }

  async findByCampusId(campusId: string): Promise<Role[]> {
    const prismaRoles = await this.prisma.role.findMany({
      where: { campusId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return PrismaRoleMapper.toDomainArrayWithPermissions(prismaRoles);
  }

  async findSystemDefaults(): Promise<Role[]> {
    const prismaRoles = await this.prisma.role.findMany({
      where: { campusId: null },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return PrismaRoleMapper.toDomainArrayWithPermissions(prismaRoles);
  }

  async save(role: CreateRoleData): Promise<Role> {
    const prismaData = PrismaRoleMapper.toPrisma(role);

    // Create role and optionally assign permissions
    const created = await this.prisma.role.create({
      data: {
        ...prismaData,
        rolePermissions: role.permissionIds?.length
          ? {
              createMany: {
                data: role.permissionIds.map((permissionId) => ({
                  permissionId,
                })),
              },
            }
          : undefined,
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return PrismaRoleMapper.toDomain(created);
  }

  async update(id: string, data: UpdateRoleData): Promise<Role> {
    const prismaData = PrismaRoleMapper.toPrismaUpdate(data);

    const updated = await this.prisma.role.update({
      where: { id },
      data: prismaData,
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return PrismaRoleMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.role.delete({
      where: { id },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.role.count({
      where: { id },
    });
    return count > 0;
  }

  async assignPermissions(
    roleId: string,
    permissionIds: string[],
  ): Promise<void> {
    if (!permissionIds.length) return;

    await this.prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId,
        permissionId,
      })),
      skipDuplicates: true,
    });
  }

  async removePermissions(
    roleId: string,
    permissionIds: string[],
  ): Promise<void> {
    if (!permissionIds.length) return;

    await this.prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId: { in: permissionIds },
      },
    });
  }

  async getPermissions(roleId: string): Promise<Permission[]> {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: {
        permission: true,
      },
      orderBy: {
        permission: {
          module: "asc",
        },
      },
    });

    return rolePermissions.map((rp) =>
      PrismaPermissionMapper.toDomain(rp.permission),
    );
  }

  async getRoleMembers(
    roleId: string,
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedRoleMembers> {
    const limit = Math.min(
      Number(params.limit) || params.defaultLimit || 20,
      params.maxLimit || 50,
    );
    const offset = Number(params.offset) || 0;
    const where = { roleId, campusId };

    const [rows, count] = await Promise.all([
      this.prisma.userRole.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { assignedAt: "desc" },
        include: {
          grantedViaStaffType: {
            select: { id: true, name: true },
          },
          user: {
            select: {
              id: true,
              clerkUid: true,
              isActive: true,
              guardians: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phoneNumber: true,
                  dateOfBirth: true,
                },
              },
              staffs: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phoneNumber: true,
                  dateOfBirth: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.userRole.count({ where }),
    ]);

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(count / limit);

    return {
      data: rows.map((row): RoleMember => {
        const source = row.grantedViaStaffTypeId ? "staff_type" : "manual";

        return {
          assignmentId: row.id,
          userId: row.userId,
          clerkUid: row.user.clerkUid,
          isActive: row.user.isActive,
          campusId: row.campusId,
          assignedAt: row.assignedAt,
          profile: this.mapRoleMemberProfile(row.user),
          provenance: {
            source,
            grantedViaStaffTypeId: row.grantedViaStaffTypeId,
            staffTypeName: row.grantedViaStaffType?.name ?? null,
            canOverride: source === "staff_type",
            warning:
              source === "staff_type" ? STAFF_TYPE_PROVENANCE_WARNING : null,
          },
        };
      }),
      pagination: {
        count,
        limit,
        offset,
        totalPages,
        currentPage,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
      },
    };
  }

  async getRoleUsers(
    roleId: string,
    page: number,
    limit: number,
  ): Promise<any> {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { userRoles: { some: { roleId } } },
        skip,
        take: safeLimit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          clerkUid: true,
          isActive: true,
          guardians: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              dateOfBirth: true,
            },
          },
          staffs: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              dateOfBirth: true,
            },
          },
        },
      }),
      this.prisma.user.count({
        where: { userRoles: { some: { roleId } } },
      }),
    ]);

    return {
      data: users,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / Math.max(safeLimit, 1)),
      },
    };
  }

  private mapRoleMemberProfile(user: {
    staffs: Array<{
      id: string;
      fullName: string;
      email: string | null;
      phoneNumber: string | null;
      dateOfBirth: Date | null;
    }>;
    guardians: Array<{
      id: string;
      fullName: string;
      email: string | null;
      phoneNumber: string | null;
      dateOfBirth: Date | null;
    }>;
  }): RoleMemberProfile {
    const profile = user.staffs[0]
      ? { type: "staff" as const, ...user.staffs[0] }
      : user.guardians[0]
        ? { type: "guardian" as const, ...user.guardians[0] }
        : null;

    if (!profile) {
      return {
        type: null,
        id: null,
        fullName: null,
        email: null,
        phoneNumber: null,
        dateOfBirth: null,
      };
    }

    return profile;
  }
}
