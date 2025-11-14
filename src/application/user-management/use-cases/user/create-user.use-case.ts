import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { User, CreateUserData, UserEntity } from '../../../../domain/user-management/user.entity';
import { UserRepository } from '../../ports/user.repository';
import { IdentityService } from '@/infra/external-services/clerk/identity.service';
import { EmailAlreadyExistsException } from '../../../../domain/user-management/exceptions/email-already-exists.exception';
import { PhoneAlreadyExistsException } from '../../../../domain/user-management/exceptions/phone-already-exists.exception';
import { InvalidUserDataException } from '../../../../domain/user-management/exceptions/invalid-user-data.exception';

export interface CreateUserInput {
  email: string;
  fullName: string;
  phoneNumber: string;
  address?: string;
  dateOfBirth?: Date;
  additionalInfo?: string;
  isActive?: boolean;
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject('USER_REPOSITORY')
    private readonly userRepository: UserRepository,
    private readonly identityService: IdentityService,
  ) {}

  async execute(input: CreateUserInput): Promise<User> {
    try {
      // 1. Validate contact information (business rule)
      UserEntity.validateContactInfo(input);

      // 2. Validate email format if provided
      if (input.email) {
        if (!UserEntity.validateEmail(input.email)) {
          throw new InvalidUserDataException('Invalid email format');
        }

        // Check email uniqueness
        const existingUserByEmail = await this.userRepository.findByEmail(input.email);
        if (existingUserByEmail) {
          throw new EmailAlreadyExistsException(input.email);
        }
      }

      // 3. Validate phone number format if provided
      if (input.phoneNumber) {
        if (!UserEntity.validatePhoneNumber(input.phoneNumber)) {
          throw new InvalidUserDataException('Invalid phone number format (Ex: +1234567890)');
        }
      }

      // 4. Create user
      const clerkUser = await this.identityService.provisionUser({
        email: input.email,
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
      });


      // 5. Prepare user data
      const userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'> = {
        clerkUid: clerkUser.clerkUid,
        email: input.email?.trim() || null,
        fullName: input.fullName?.trim() || null,
        phoneNumber: input.phoneNumber?.trim() || null,
        address: input.address?.trim() || null,
        dateOfBirth: input.dateOfBirth || null,
        isActive: input.isActive ?? true,
      };

      // 6. Save user to database
      try {
        const savedUser = await this.userRepository.save(userData);

        // Update external identity
        await this.identityService.updateUser(clerkUser.clerkUid, {
          externalId: savedUser.id,
        });

        return savedUser;
      } catch (error) {
        // Rollback Clerk user if database save fails
        await this.identityService.deleteIdentity(clerkUser.clerkUid).catch(() => {});
        throw error;
      }
    } catch (error) {
      // Re-throw domain exceptions as NestJS exceptions
      if (error instanceof EmailAlreadyExistsException) {
        throw new ConflictException(error.message);
      }
      if (error instanceof PhoneAlreadyExistsException) {
        throw new ConflictException(error.message);
      }
      if (error instanceof InvalidUserDataException) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
