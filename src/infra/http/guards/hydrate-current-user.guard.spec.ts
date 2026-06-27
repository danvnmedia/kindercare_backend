import { UnauthorizedException } from "@nestjs/common";

import { createUser } from "@/test-utils";

import { RequestContext } from "../context/request-context.service";
import { HydrateCurrentUserGuard } from "./hydrate-current-user.guard";

describe("HydrateCurrentUserGuard", () => {
  let guard: HydrateCurrentUserGuard;
  let requestContext: jest.Mocked<RequestContext>;

  beforeEach(() => {
    requestContext = {
      getUserOrFail: jest.fn(),
    } as unknown as jest.Mocked<RequestContext>;

    guard = new HydrateCurrentUserGuard(requestContext);
  });

  it("hydrates the authenticated domain user for CurrentUser", async () => {
    const user = createUser();
    requestContext.getUserOrFail.mockResolvedValue(user);

    await expect(guard.canActivate()).resolves.toBe(true);

    expect(requestContext.getUserOrFail).toHaveBeenCalledTimes(1);
  });

  it("propagates authentication or user lookup failures", async () => {
    const error = new UnauthorizedException("Authentication required");
    requestContext.getUserOrFail.mockRejectedValue(error);

    await expect(guard.canActivate()).rejects.toBe(error);
  });
});
