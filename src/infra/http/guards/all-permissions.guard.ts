import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import {
  getPermissionIdsForCampus,
  hasAllPermissions,
} from "@/application/rbac/permission-access";

import { RequestContext } from "../context/request-context.service";
import { REQUIRED_ALL_PERMISSIONS_KEY } from "../decorators/require-all-permissions.decorator";

@Injectable()
export class AllPermissionsGuard implements CanActivate {
  private readonly logger = new Logger(AllPermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly requestContext: RequestContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ALL_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const user = await this.requestContext.getUser();
    if (!user) {
      this.logger.warn("AllPermissionsGuard: No user found in request context");
      return false;
    }

    if (user.hasSystemRole()) {
      return true;
    }

    const campusId = this.requestContext.campusId;
    const userPermissionIds = getPermissionIdsForCampus(user, campusId);
    const hasRequiredPermissions = hasAllPermissions(
      userPermissionIds,
      requiredPermissions,
    );

    if (!hasRequiredPermissions) {
      this.logger.warn(
        `AllPermissionsGuard: User ${user.id} with permissions [${Array.from(userPermissionIds).join(", ")}] in campus ${campusId ?? "global"} does not have all required permissions [${requiredPermissions.join(", ")}]`,
      );
    }

    return hasRequiredPermissions;
  }
}
