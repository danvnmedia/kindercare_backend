import "reflect-metadata";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { createUser } from "@/test-utils";
import {
  CMS_ROUTE_VISIBILITY_KEY,
  CmsRouteVisibility,
} from "../decorators/cms-route-visibility.decorator";

import { CommentController } from "../controllers/comment.controller";
import {
  canGuardianReadCmsRoute,
  getActiveGuardianProfileForCampus,
  getCmsRouteVisibility,
} from "./cms-route-visibility.guard";

const CAMPUS_A = "11111111-1111-4111-8111-111111111111";
const CAMPUS_B = "22222222-2222-4222-8222-222222222222";

function context(
  handler: (...args: unknown[]) => unknown = jest.fn(),
  controller: abstract new (...args: never[]) => unknown = class {},
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

function reflectorFor(metadata: Record<string, unknown>): Reflector {
  return {
    getAllAndOverride: jest.fn((key: string) => metadata[key]),
  } as unknown as Reflector;
}

function guardianProfile(id: string, campusId: string) {
  return {
    type: "guardian" as const,
    id,
    campusId,
    fullName: id,
    email: `${id}@example.com`,
    phoneNumber: null,
    dateOfBirth: null,
    gender: null,
  };
}

describe("CMS route visibility policy", () => {
  it.each([
    "getPostComments",
    "createComment",
    "createReply",
    "updateComment",
    "deleteComment",
  ] as Array<keyof CommentController>)(
    "treats CommentController.%s as guardian-readable",
    (methodName) => {
      const reflector = new Reflector();

      expect(
        getCmsRouteVisibility(
          reflector,
          context(CommentController.prototype[methodName], CommentController),
        ),
      ).toBe(CmsRouteVisibility.PUBLIC_READ);
    },
  );

  it.each([
    "getManagementComments",
    "createManagementComment",
    "deleteManagementComment",
  ] as Array<keyof CommentController>)(
    "keeps CommentController.%s staff-only",
    (methodName) => {
      const reflector = new Reflector();

      expect(
        getCmsRouteVisibility(
          reflector,
          context(CommentController.prototype[methodName], CommentController),
        ),
      ).toBe(CmsRouteVisibility.STAFF_ONLY);
    },
  );

  it("keeps explicit staff-only routes private", () => {
    const reflector = reflectorFor({
      [CMS_ROUTE_VISIBILITY_KEY]: CmsRouteVisibility.STAFF_ONLY,
    });

    expect(getCmsRouteVisibility(reflector, context())).toBe(
      CmsRouteVisibility.STAFF_ONLY,
    );
  });

  it("selects the guardian profile matching the requested campus", () => {
    const user = createUser({
      profiles: [
        guardianProfile("guardian-a", CAMPUS_A),
        guardianProfile("guardian-b", CAMPUS_B),
      ],
    });

    expect(getActiveGuardianProfileForCampus(user, CAMPUS_B)?.id).toBe(
      "guardian-b",
    );
  });

  it("uses the staff RBAC path for mixed identities in one campus", () => {
    const user = createUser({
      profiles: [
        guardianProfile("guardian-a", CAMPUS_A),
        {
          type: "staff",
          id: "staff-a",
          campusId: CAMPUS_A,
          fullName: "Staff A",
          email: "staff@example.com",
          phoneNumber: null,
          dateOfBirth: null,
          gender: null,
        },
      ],
    });
    const reflector = reflectorFor({
      [CMS_ROUTE_VISIBILITY_KEY]: CmsRouteVisibility.PUBLIC_READ,
    });

    expect(canGuardianReadCmsRoute(reflector, context(), user, CAMPUS_A)).toBe(
      false,
    );
  });

  it("denies guardian visibility when no active profile matches the campus", () => {
    const user = createUser({
      profiles: [guardianProfile("guardian-a", CAMPUS_A)],
    });
    const reflector = reflectorFor({
      [CMS_ROUTE_VISIBILITY_KEY]: CmsRouteVisibility.PUBLIC_READ,
    });

    expect(canGuardianReadCmsRoute(reflector, context(), user, CAMPUS_B)).toBe(
      false,
    );
  });
});
