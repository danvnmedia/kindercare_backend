import { Injectable, Inject } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import {
  UserRepository,
  FindAllUsersParams,
  PaginatedUsers,
} from "@/application/user-management/ports/user.repository";
import { User } from "@/domain/user-management";
import { PrismaUserMapper } from "../mapper/prisma-user.mapper";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<User | null> {
    const prismaUser = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
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
            guardian: {
              email: email,
            },
          },
          {
            staff: {
              email: email,
            },
          },
        ],
      },
      include: {
        userRoles: { include: { role: true } },
      },
    });
    return prismaUser ? PrismaUserMapper.toDomain(prismaUser) : null;
  }

  async findByClerkUid(clerkUid: string): Promise<User | null> {
    const prismaUser = await this.prisma.user.findUnique({
      where: { clerkUid },
      include: { userRoles: { include: { role: true } } },
    });
    return prismaUser ? PrismaUserMapper.toDomain(prismaUser) : null;
  }

  async findAll(params: FindAllUsersParams): Promise<PaginatedUsers> {
    params.allowedFilterFields = ["isActive"];
    params.allowedSortFields = ["createdAt"];

    return await this.queryService.executeQuery<User>(
      this.prisma,
      "user",
      params,
      {
        include: {
          userRoles: { include: { role: true } },
          guardian: true,
          staff: true,
        },
      },
      PrismaUserMapper,
    );
  }

  async save(user: User): Promise<User> {
    const prismaData = PrismaUserMapper.toPrisma(user);
    const created = await this.prisma.user.create({
      data: prismaData,
      include: { userRoles: { include: { role: true } } },
    });
    return PrismaUserMapper.toDomain(created);
  }

  async update(user: User): Promise<User> {
    const prismaData = PrismaUserMapper.toPrismaUpdate(user);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: prismaData,
      include: { userRoles: { include: { role: true } } },
    });
    return PrismaUserMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
  }

  async assignRoles(userId: string, roleIds: string[]): Promise<void> {
    await this.prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({ userId, roleId })),
      skipDuplicates: true,
    });
  }

  async removeRoles(userId: string, roleIds: string[]): Promise<void> {
    await this.prisma.userRole.deleteMany({
      where: {
        userId,
        roleId: { in: roleIds },
      },
    });
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
        include: { role: true },
      }),
      this.prisma.userRole.count({
        where: { userId },
      }),
    ]);

    return {
      data: roles.map((item) => item.role),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
