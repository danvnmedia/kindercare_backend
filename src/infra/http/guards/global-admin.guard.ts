import { CanActivate, Injectable, Logger } from "@nestjs/common";

import { isGlobalAdmin } from "../context/campus-context";
import { RequestContext } from "../context/request-context.service";

@Injectable()
export class GlobalAdminGuard implements CanActivate {
  private readonly logger = new Logger(GlobalAdminGuard.name);

  constructor(private readonly requestContext: RequestContext) {}

  async canActivate(): Promise<boolean> {
    const user = await this.requestContext.getUserOrFail();
    const allowed = isGlobalAdmin(user);

    if (!allowed) {
      this.logger.warn(
        `GlobalAdminGuard: User ${user.id} does not have a global system role`,
      );
    }

    return allowed;
  }
}
