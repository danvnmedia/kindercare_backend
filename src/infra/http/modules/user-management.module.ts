import { Module } from '@nestjs/common';

// Controllers
import { UserController } from '../controllers/user-management/user.controller';
import { RoleController } from '../controllers/user-management/role.controller';

// Use Cases - User
import { CreateUserUseCase } from '@/application/user-management/use-cases/user/create-user.use-case';
import { GetUserByIdUseCase } from '@/application/user-management/use-cases/user/get-user-by-id.use-case';
import { GetAllUsersUseCase } from '@/application/user-management/use-cases/user/get-all-users.use-case';
import { UpdateUserUseCase } from '@/application/user-management/use-cases/user/update-user.use-case';
import { DeleteUserUseCase } from '@/application/user-management/use-cases/user/delete-user.use-case';
import { AssignRolesToUserUseCase } from '@/application/user-management/use-cases/user/assign-roles-to-user.use-case';
import { RemoveRolesFromUserUseCase } from '@/application/user-management/use-cases/user/remove-roles-from-user.use-case';

// Use Cases - Role
import { CreateRoleUseCase } from '@/application/user-management/use-cases/role/create-role.use-case';
import { GetRoleByIdUseCase } from '@/application/user-management/use-cases/role/get-role-by-id.use-case';
import { GetAllRolesUseCase } from '@/application/user-management/use-cases/role/get-all-roles.use-case';
import { UpdateRoleUseCase } from '@/application/user-management/use-cases/role/update-role.use-case';
import { DeleteRoleUseCase } from '@/application/user-management/use-cases/role/delete-role.use-case';
import { AssignUsersToRoleUseCase } from '@/application/user-management/use-cases/role/assign-users-to-role.use-case';
import { RemoveUsersFromRoleUseCase } from '@/application/user-management/use-cases/role/remove-users-from-role.use-case';

// Repositories
import { PrismaUserRepository } from '@/infra/persistence/prisma/repositories/prisma-user.repository';
import { PrismaRoleRepository } from '@/infra/persistence/prisma/repositories/prisma-role.repository';

// Modules
import { PrismaModule } from '@/infra/persistence/prisma/prisma.module';
import { ClerkModule } from '@/infra/external-services/clerk/clerk.module';

@Module({
  imports: [PrismaModule, ClerkModule],
  controllers: [UserController, RoleController],
  providers: [
    // User Use Cases
    CreateUserUseCase,
    GetUserByIdUseCase,
    GetAllUsersUseCase,
    UpdateUserUseCase,
    DeleteUserUseCase,
    AssignRolesToUserUseCase,
    RemoveRolesFromUserUseCase,

    // Role Use Cases
    CreateRoleUseCase,
    GetRoleByIdUseCase,
    GetAllRolesUseCase,
    UpdateRoleUseCase,
    DeleteRoleUseCase,
    AssignUsersToRoleUseCase,
    RemoveUsersFromRoleUseCase,

    // Repositories with Dependency Injection Tokens
    {
      provide: 'USER_REPOSITORY',
      useClass: PrismaUserRepository,
    },
    {
      provide: 'ROLE_REPOSITORY',
      useClass: PrismaRoleRepository,
    },
  ],
  exports: ['USER_REPOSITORY', 'ROLE_REPOSITORY'],
})
export class UserManagementModule {}
