import { Injectable } from '@nestjs/common';
import { User } from '@/domain/user-management';
import { UserRepository } from '../ports/user.repository';
import { PaginatedResult, StandardRequest } from '@/core/modules/standard-response';

@Injectable()
export class GetAllUsersUseCase {
    constructor(private readonly userRepository: UserRepository) {}

    async execute(params: StandardRequest): Promise<PaginatedResult<User>> {
        return await this.userRepository.findManyWithPagination(params);
    }
}