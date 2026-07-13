import "reflect-metadata";
import { HttpStatus, RequestMethod } from "@nestjs/common";
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
} from "@nestjs/common/constants";
import { DECORATORS } from "@nestjs/swagger";

import {
  CMS_ROUTE_VISIBILITY_KEY,
  CmsRouteVisibility,
  REQUIRE_CAMPUS_ACCESS_KEY,
} from "../decorators";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { CommentController } from "./comment.controller";

function handler(name: keyof CommentController) {
  return CommentController.prototype[name];
}

function metadata<T>(
  key: string,
  name: keyof CommentController,
): T | undefined {
  return Reflect.getMetadata(key, handler(name));
}

describe("CommentController CMS route metadata", () => {
  it("requires Clerk auth at controller level", () => {
    const guards =
      Reflect.getMetadata(GUARDS_METADATA, CommentController) ?? [];

    expect(guards).toContain(ClerkAuthGuard);
  });

  it.each([
    "getPostComments",
    "createComment",
    "createReply",
    "updateComment",
    "deleteComment",
  ] as Array<keyof CommentController>)(
    "%s exposes guardian engagement only through the public visibility policy",
    (methodName) => {
      expect(
        metadata<CmsRouteVisibility>(CMS_ROUTE_VISIBILITY_KEY, methodName),
      ).toBe(CmsRouteVisibility.PUBLIC_READ);
      expect(metadata<string[]>(PERMISSIONS_KEY, methodName)).toEqual([
        "post.read",
        "post.manage",
      ]);
      expect(metadata<unknown[]>(GUARDS_METADATA, methodName)).toContain(
        PermissionsGuard,
      );
      expect(metadata(REQUIRE_CAMPUS_ACCESS_KEY, methodName)).toEqual({});
    },
  );

  it.each(["createManagementComment", "createComment", "createReply"] as Array<
    keyof CommentController
  >)("%s documents Nest's default POST 201 status", (methodName) => {
    const route = handler(methodName);
    const responses = Reflect.getMetadata(
      DECORATORS.API_RESPONSE,
      route,
    ) as Record<string, unknown>;

    expect(Reflect.getMetadata(METHOD_METADATA, route)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, route)).toBe(
      HttpStatus.CREATED,
    );
    expect(responses).toHaveProperty(String(HttpStatus.CREATED));
    expect(responses).not.toHaveProperty(String(HttpStatus.OK));
  });

  it.each([
    "getManagementComments",
    "createManagementComment",
    "deleteManagementComment",
  ] as Array<keyof CommentController>)(
    "%s remains explicit staff-only management access",
    (methodName) => {
      expect(
        metadata<CmsRouteVisibility>(CMS_ROUTE_VISIBILITY_KEY, methodName),
      ).toBe(CmsRouteVisibility.STAFF_ONLY);
      expect(metadata<string[]>(PERMISSIONS_KEY, methodName)).toEqual([
        "post.manage",
      ]);
      expect(metadata<unknown[]>(GUARDS_METADATA, methodName)).toContain(
        PermissionsGuard,
      );
      expect(metadata(REQUIRE_CAMPUS_ACCESS_KEY, methodName)).toEqual({});
    },
  );
});
