import { Module } from '@nestjs/common';
import { UserRepository } from '@/application/user-management/ports/user.repository';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaUserRepository } from './prisma/repositories/prisma-user.repository';

@Module({
    imports: [PrismaModule],
    providers: [
        {
            provide: UserRepository,
            useClass: PrismaUserRepository,
        },
    ],
    exports: [UserRepository],
})
export class PersistenceModule {}