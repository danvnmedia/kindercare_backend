import { Injectable, Inject, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { User, UpdateUserData, UserEntity } from '../../../../domain/user-management/user.entity';
import { UserRepository } from '../../ports/user.repository';
import { IdentityService } from '@/infra/external-services/clerk/identity.service';
import { UserNotFoundException } from '../../../../domain/user-management/exceptions/user-not-found.exception';
import { InvalidUserDataException } from '../../../../domain/user-management/exceptions/invalid-user-data.exception';

export interface UpdateUserInput {
  email?: string;
  fullName?: string;
  phoneNumber?: string;
  password?: string;
  address?: string;
  dateOfBirth?: Date;
  isActive?: boolean;
}

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject('USER_REPOSITORY')
    private readonly userRepository: UserRepository,
    private readonly identityService: IdentityService,
  ) {}

  async execute(id: number, input: UpdateUserInput): Promise<User> {
    try {
      // 1. Find existing user
      const currentUser = await this.userRepository.findById(id);
      if (!currentUser) {
        throw new UserNotFoundException(id);
      }

      // 2. Validate email format if provided
      if (input.email && input.email !== currentUser.email) {
        if (!UserEntity.validateEmail(input.email)) {
          throw new InvalidUserDataException('Invalid email format');
        }
      }

      // 3. Validate phone number format if provided
      if (input.phoneNumber && input.phoneNumber !== currentUser.phoneNumber) {
        if (!UserEntity.validatePhoneNumber(input.phoneNumber)) {
          throw new InvalidUserDataException('Invalid phone number format (must be 10-11 digits starting with 0)');
        }
      }

      // 4. Check if identity needs to be updated
      const needsIdentityUpdate =
        (input.email && input.email !== currentUser.email) ||
        (input.phoneNumber && input.phoneNumber !== currentUser.phoneNumber) ||
        input.password ||
        input.fullName;

      // 5. Update Clerk identity if needed
      if (needsIdentityUpdate) {
        if (!currentUser.clerkUid) {
          throw new BadRequestException('User is not linked to identity service');
        }

        await this.identityService.updateUser(currentUser.clerkUid, {
          email: input.email,
          phoneNumber: input.phoneNumber,
          password: input.password,
          fullName: input.fullName,
        });
      }

      // 6. Prepare update data
      const updateData: UpdateUserData = {
        email: input.email?.trim() || currentUser.email,
        fullName: input.fullName?.trim(),
        phoneNumber: input.phoneNumber?.trim(),
        address: input.address?.trim(),
        dateOfBirth: input.dateOfBirth,
        isActive: input.isActive,
      };

      // 7. Update database
      try {
        const updatedUser = await this.userRepository.update(id, updateData);
        return updatedUser;
      } catch (error) {
        // Rollback Clerk changes if database update fails
        if (needsIdentityUpdate && currentUser.clerkUid) {
          const revertEmail = input.email && input.email !== currentUser.email ? currentUser.email : undefined;
          const revertPhone = input.phoneNumber && input.phoneNumber !== currentUser.phoneNumber ? currentUser.phoneNumber : undefined;

          if (revertEmail || revertPhone) {
            await this.identityService
              .updateUser(currentUser.clerkUid, {
                email: revertEmail || undefined,
                phoneNumber: revertPhone || undefined,
              })
              .catch(() => {});
          }
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof InvalidUserDataException) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
