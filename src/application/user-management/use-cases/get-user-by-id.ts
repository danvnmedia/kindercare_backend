import { Injectable } from '@nestjs/common';
import { User } from '@/domain/user-management';
import { UserRepository } from '../ports/user.repository';

@Injectable()
export class GetUserByIdUseCase {
    constructor(private readonly userRepository: UserRepository) {}

    async execute(id: string): Promise<User | null> {
        return await this.userRepository.findById(id);
    }
}