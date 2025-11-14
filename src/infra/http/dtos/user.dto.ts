import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Expose } from 'class-transformer';

export class CreateUserDto {
    @ApiProperty({ example: 'John Doe', description: 'User name' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'john@example.com', description: 'User email' })
    @IsEmail()
    email: string;
}

export class UserResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'User ID (UUID)' })
    @Expose()
    id: string;

    @ApiProperty({ example: 'John Doe', description: 'User name' })
    @Expose()
    name: string;

    @ApiProperty({ example: 'john@example.com', description: 'User email' })
    @Expose()
    email: string;

    @ApiProperty({ example: '2023-01-01T00:00:00.000Z', description: 'Created date' })
    @Expose()
    createdAt: Date;

    @ApiProperty({ example: '2023-01-01T00:00:00.000Z', description: 'Updated date' })
    @Expose()
    updatedAt: Date;
}