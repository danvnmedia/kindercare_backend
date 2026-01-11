import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import {
  RoleRepository,
  PaginatedRoles,
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

  async findAll(params: StandardRequest): Promise<PaginatedRoles> {
    params.allowedFilterFields = [
      "name",
      "description",
      "campusId",
      "isSystemDefault",
    ];
    params.allowedSortFields = ["createdAt", "name"];

    return await this.queryService.executeQuery<Role>(
      this.prisma,
      "role",
      params,
      {},
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

  async assignUsers(roleId: string, userIds: string[]): Promise<void> {
    if (!userIds.length) return;

    await this.prisma.userRole.createMany({
      data: userIds.map((userId) => ({ userId, roleId })),
      skipDuplicates: true,
    });
  }

  async removeUsers(roleId: string, userIds: string[]): Promise<void> {
    if (!userIds.length) return;

    await this.prisma.userRole.deleteMany({
      where: { roleId, userId: { in: userIds } },
    });
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
}
