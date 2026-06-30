import { CanActivate, Injectable } from "@nestjs/common";

import { RequestContext } from "../context/request-context.service";

@Injectable()
export class HydrateCurrentUserGuard implements CanActivate {
  constructor(private readonly requestContext: RequestContext) {}

  async canActivate(): Promise<boolean> {
    await this.requestContext.getUserOrFail();
    return true;
  }
}
