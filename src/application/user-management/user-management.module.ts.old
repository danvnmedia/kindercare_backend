import { Module } from '@nestjs/common';
import { CreateUserUseCase, GetAllUsersUseCase, GetUserByIdUseCase } from './use-cases';

@Module({
    providers: [
        CreateUserUseCase,
        GetAllUsersUseCase,
        GetUserByIdUseCase,
    ],
    exports: [
        CreateUserUseCase,
        GetAllUsersUseCase,
        GetUserByIdUseCase,
    ],
})
export class UserManagementModule {}