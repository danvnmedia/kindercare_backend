import { Injectable } from '@nestjs/common';
import { UserRepository } from '@/application/user-management/ports/user.repository';
import { User } from '@/domain/user-management';
import { PrismaService } from '../prisma.service';
import { PaginatedResult, StandardRequest, PrismaQueryService } from '@/core/modules/standard-response';
import { PrismaUserMapper } from '../mapper/prisma-user-mapper';

@Injectable()
export class PrismaUserRepository implements UserRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly prismaQueryService: PrismaQueryService,
    ) {}

    async findById(id: string): Promise<User | null> {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            return null;
        }

        return PrismaUserMapper.toDomain(user);
    }

    async findByEmail(email: string): Promise<User | null> {
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: {
                profile: true,
            },
        });

        if (!user) {
            return null;
        }

        return PrismaUserMapper.toDomain(user);
    }

    async findAll(): Promise<User[]> {
        const users = await this.prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
        });

        return users.map(user => PrismaUserMapper.toDomain(user));
    }

    async save(user: User): Promise<void> {
        const userData = PrismaUserMapper.toPersistence(user);
        
        await this.prisma.user.upsert({
            where: { id: user.id },
            update: {
                name: userData.name,
                email: userData.email,
                updatedAt: userData.updatedAt,
            },
            create: userData,
        });
    }

    async findManyWithPagination(params: StandardRequest): Promise<PaginatedResult<User>> {
        return this.prismaQueryService.executeQuery(
            this.prisma,
            'user',
            params,
            {
                include: {
                    profile: true,
                },
                orderBy: { createdAt: 'desc' },
            },
            PrismaUserMapper
        );
    }


    async delete(id: string): Promise<void> {
        await this.prisma.user.delete({
            where: { id },
        });
    }
}