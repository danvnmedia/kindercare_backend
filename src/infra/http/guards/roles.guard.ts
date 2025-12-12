import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  Inject,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { UserRepository } from "@/application/user-management/ports/user.repository";

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true; // No roles specified, access granted
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // User object should be attached by a previous authentication guard

    if (!user) {
      this.logger.warn("RolesGuard: No user found in request");
      return false;
    }

    // Fetch user with roles from the repository
    const fullUser = await this.userRepository.findById(user.id);

    if (!fullUser || !fullUser.roles) {
      this.logger.warn(`User ${user.id} has no roles assigned`);
      return false;
    }

    const hasRequiredRole = fullUser.roles.some((role) =>
      requiredRoles.includes(role.name),
    );

    if (!hasRequiredRole) {
      this.logger.warn(
        `User ${user.id} with roles [${fullUser.roles.map((r) => r.name).join(", ")}] does not have required roles [${requiredRoles.join(", ")}]`,
      );
    }

    return hasRequiredRole;
  }
}
