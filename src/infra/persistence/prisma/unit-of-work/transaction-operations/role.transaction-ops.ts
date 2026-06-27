import {
  CreateRoleData,
  Role,
  UpdateRoleData,
} from "@/domain/user-management/role.entity";
import { PrismaRoleMapper } from "../../mapper/prisma-role.mapper";
import { PrismaTransactionClient } from "./base.transaction-ops";

const ROLE_WITH_PERMISSIONS_INCLUDE = {
  rolePermissions: {
    include: {
      permission: true,
    },
  },
} as const;

export class RoleTransactionOps {
  constructor(private readonly tx: PrismaTransactionClient) {}

  async createRole(role: CreateRoleData): Promise<Role> {
    const prismaData = PrismaRoleMapper.toPrisma(role);

    const created = await this.tx.role.create({
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
      include: ROLE_WITH_PERMISSIONS_INCLUDE,
    });

    return PrismaRoleMapper.toDomain(created);
  }

  async updateRole(id: string, role: UpdateRoleData): Promise<Role> {
    const updated = await this.tx.role.update({
      where: { id },
      data: PrismaRoleMapper.toPrismaUpdate(role),
      include: ROLE_WITH_PERMISSIONS_INCLUDE,
    });

    return PrismaRoleMapper.toDomain(updated);
  }

  async deleteRole(id: string): Promise<void> {
    await this.tx.role.delete({
      where: { id },
    });
  }

  async addRolePermissions(
    roleId: string,
    permissionIds: string[],
  ): Promise<number> {
    if (permissionIds.length === 0) {
      return 0;
    }

    const result = await this.tx.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId,
        permissionId,
      })),
      skipDuplicates: true,
    });

    return result.count;
  }

  async removeRolePermissions(
    roleId: string,
    permissionIds: string[],
  ): Promise<number> {
    if (permissionIds.length === 0) {
      return 0;
    }

    const result = await this.tx.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId: { in: permissionIds },
      },
    });

    return result.count;
  }

  async replaceRolePermissions(
    roleId: string,
    permissionIds: string[],
  ): Promise<void> {
    await this.tx.rolePermission.deleteMany({
      where: { roleId },
    });

    if (permissionIds.length === 0) {
      return;
    }

    await this.tx.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId,
        permissionId,
      })),
    });
  }
}
