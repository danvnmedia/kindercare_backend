import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { UserRepository } from "../../../application/user-management/ports/user.repository";

/**
 * Interceptor to fetch and attach User entity to request.
 * Works with ClerkAuthGuard - uses request.clerkId to fetch user from database.
 *
 * @example
 * ```typescript
 * @Get('profile')
 * @UseGuards(ClerkAuthGuard)
 * @UseInterceptors(UserInterceptor)
 * async getProfile(@UserDecorator() user: User) {
 *   return user;
 * }
 * ```
 */
@Injectable()
export class UserInterceptor implements NestInterceptor {
  private readonly logger = new Logger(UserInterceptor.name);

  constructor(
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const clerkId = request.clerkId;

    if (!clerkId) {
      this.logger.warn(
        "No clerkId found in request. Ensure ClerkAuthGuard is applied.",
      );
      return next.handle();
    }

    try {
      // Fetch user from database by clerkId
      const user = await this.userRepository.findByClerkUid(clerkId);

      if (user) {
        // Attach full user object to request
        request.user = user;
      } else {
        this.logger.warn(`User not found for clerkId: ${clerkId}`);
      }
    } catch (error) {
      this.logger.error("Failed to fetch user", error);
    }

    return next.handle();
  }
}
