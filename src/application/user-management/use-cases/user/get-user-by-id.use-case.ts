import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { User } from "../../../../domain/user-management/user.entity";
import { UserRepository } from "../../ports/user.repository";
import { UserNotFoundException } from "../../../../domain/user-management/exceptions/user-not-found.exception";

@Injectable()
export class GetUserByIdUseCase {
  constructor(
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
  ) {}

  async execute(id: string): Promise<User> {
    try {
      const user = await this.userRepository.findById(id);

      if (!user) {
        throw new UserNotFoundException(id);
      }

      return user;
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
