import { User as PrismaUser } from '@prisma/client';
import { User } from '@/domain/user-management';
import { UniqueEntityID } from '@/core/entities';

export class PrismaUserMapper {
    static toDomain(raw: PrismaUser): User {
        return User.create(
            {
                name: raw.name,
                email: raw.email,
                createdAt: raw.createdAt,
                updatedAt: raw.updatedAt,
            },
            new UniqueEntityID(raw.id),
        );
    }

    static toPersistence(user: User): Omit<PrismaUser, 'createdAt' | 'updatedAt'> & {
        createdAt?: Date;
        updatedAt?: Date;
    } {
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }

    static toDomainArray(rawUsers: PrismaUser[]): User[] {
        return rawUsers.map(user => this.toDomain(user));
    }
}