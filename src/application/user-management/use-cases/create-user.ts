import { Injectable } from '@nestjs/common';
import { User } from '@/domain/user-management';
import { UserRepository } from '../ports/user.repository';

export interface CreateUserDto {
    name: string;
    email: string;
}

@Injectable()
export class CreateUserUseCase {
    constructor(private readonly userRepository: UserRepository) {}

    async execute(dto: CreateUserDto): Promise<User> {
        const existingUser = await this.userRepository.findByEmail(dto.email);
        
        if (existingUser) {
            throw new Error('User with this email already exists');
        }

        const user = User.create({
            name: dto.name,
            email: dto.email,
        });

        await this.userRepository.save(user);
        
        return user;
    }
}