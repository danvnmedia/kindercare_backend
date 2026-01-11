import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { PermissionRepository } from "@/application/rbac/ports/permission.repository";
import { Permission, CreatePermissionData } from "@/domain/rbac";
import { PrismaPermissionMapper } from "../mapper/prisma-permission.mapper";

@Injectable()
export class PrismaPermissionRepository implements PermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Permission | null> {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
    });

    return permission ? PrismaPermissionMapper.toDomain(permission) : null;
  }

  async findAll(): Promise<Permission[]> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { id: "asc" }],
    });

    return PrismaPermissionMapper.toDomainArray(permissions);
  }

  async findByModule(module: string): Promise<Permission[]> {
    const permissions = await this.prisma.permission.findMany({
      where: { module },
      orderBy: { id: "asc" },
    });

    return PrismaPermissionMapper.toDomainArray(permissions);
  }

  async findByIds(ids: string[]): Promise<Permission[]> {
    if (ids.length === 0) {
      return [];
    }

    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: ids } },
      orderBy: [{ module: "asc" }, { id: "asc" }],
    });

    return PrismaPermissionMapper.toDomainArray(permissions);
  }

  async save(data: CreatePermissionData): Promise<Permission> {
    const prismaData = PrismaPermissionMapper.toPrisma(data);

    const created = await this.prisma.permission.create({
      data: prismaData,
    });

    return PrismaPermissionMapper.toDomain(created);
  }

  async saveMany(data: CreatePermissionData[]): Promise<Permission[]> {
    if (data.length === 0) {
      return [];
    }

    const prismaData = data.map((d) => PrismaPermissionMapper.toPrisma(d));

    await this.prisma.permission.createMany({
      data: prismaData,
      skipDuplicates: true,
    });

    // Return the created permissions
    const ids = data.map((d) => d.id);
    return this.findByIds(ids);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.permission.count({
      where: { id },
    });

    return count > 0;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.permission.delete({
      where: { id },
    });
  }
}
