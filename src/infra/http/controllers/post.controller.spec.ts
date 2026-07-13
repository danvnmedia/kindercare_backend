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
import { STANDARD_RESPONSE_KEY } from "@/core/modules/standard-response/decorators";
import { PostResponse } from "../dtos/post/post.response";
import { PostController } from "./post.controller";

function handler(name: keyof PostController) {
  return PostController.prototype[name];
}

function permissionsFor(name: keyof PostController): string[] | undefined {
  return Reflect.getMetadata(PERMISSIONS_KEY, handler(name));
}

function guardsFor(name: keyof PostController): unknown[] {
  return Reflect.getMetadata(GUARDS_METADATA, handler(name)) ?? [];
}

function campusMetadataFor(name: keyof PostController): unknown {
  return Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler(name));
}

function visibilityFor(
  name: keyof PostController,
): CmsRouteVisibility | undefined {
  return Reflect.getMetadata(CMS_ROUTE_VISIBILITY_KEY, handler(name));
}

describe("PostController RBAC route metadata", () => {
  it("requires Clerk auth at controller level", () => {
    const classGuards = Reflect.getMetadata(GUARDS_METADATA, PostController);

    expect(classGuards).toContain(ClerkAuthGuard);
  });

  it.each([
    ["create", ["post.create", "post.manage"]],
    ["findMany", ["post.list", "post.manage"]],
    ["getAudienceFacets", ["post.list", "post.manage"]],
    ["getPendingApprovals", ["post.review", "post.manage"]],
    ["getPinnedPosts", ["post.read", "post.manage"]],
    ["findOne", ["post.read", "post.manage"]],
    ["update", ["post.update", "post.manage"]],
    ["remove", ["post.delete", "post.manage"]],
    ["addAttachment", ["post.update", "post.manage"]],
    ["removeAttachment", ["post.update", "post.manage"]],
    ["reorderAttachments", ["post.update", "post.manage"]],
    ["batchTransitionPosts", ["post.update", "post.review", "post.manage"]],
    ["transitionPost", ["post.update", "post.review", "post.manage"]],
    ["getPostHistory", ["post.read", "post.manage"]],
    ["getApprovalHistory", ["post.review", "post.manage"]],
    ["toggleHeart", ["post.read", "post.manage"]],
    ["getHeartStatus", ["post.read", "post.manage"]],
    ["pinPost", ["post.manage"]],
    ["unpinPost", ["post.manage"]],
  ] as Array<[keyof PostController, string[]]>)(
    "%s requires expected post permission metadata and PermissionsGuard",
    (methodName, expectedPermissions) => {
      expect(permissionsFor(methodName)).toEqual(expectedPermissions);
      expect(guardsFor(methodName)).toContain(PermissionsGuard);
    },
  );

  it.each([
    "create",
    "findMany",
    "getAudienceFacets",
    "getPendingApprovals",
    "getPinnedPosts",
    "findOne",
    "update",
    "remove",
    "addAttachment",
    "removeAttachment",
    "reorderAttachments",
    "batchTransitionPosts",
    "transitionPost",
    "getPostHistory",
    "getApprovalHistory",
    "toggleHeart",
    "getHeartStatus",
    "pinPost",
    "unpinPost",
  ] as Array<keyof PostController>)(
    "%s requires campus context",
    (methodName) => {
      expect(campusMetadataFor(methodName)).toEqual({});
    },
  );

  it.each([
    "findMany",
    "getPinnedPosts",
    "findOne",
    "toggleHeart",
    "getHeartStatus",
  ] as Array<keyof PostController>)(
    "%s is explicitly guardian-readable",
    (methodName) => {
      expect(visibilityFor(methodName)).toBe(CmsRouteVisibility.PUBLIC_READ);
    },
  );

  it.each([
    "create",
    "addAttachment",
    "batchTransitionPosts",
    "transitionPost",
    "toggleHeart",
    "pinPost",
  ] as Array<keyof PostController>)(
    "%s documents Nest's default POST 201 status",
    (methodName) => {
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
    },
  );

  it("documents the resulting post and truthful list filters", () => {
    const reorderOptions = Reflect.getMetadata(
      STANDARD_RESPONSE_KEY,
      handler("reorderAttachments"),
    );
    const listOptions = Reflect.getMetadata(
      STANDARD_RESPONSE_KEY,
      handler("findMany"),
    );

    expect(reorderOptions.type).toBe(PostResponse);
    expect(listOptions.allowedFilterFields).toContain("publishAt");
    expect(listOptions.allowedFilterFields).not.toContain("audiences");
  });

  it.each([
    "create",
    "getAudienceFacets",
    "getPendingApprovals",
    "update",
    "remove",
    "addAttachment",
    "removeAttachment",
    "reorderAttachments",
    "batchTransitionPosts",
    "transitionPost",
    "getPostHistory",
    "getApprovalHistory",
    "pinPost",
    "unpinPost",
  ] as Array<keyof PostController>)(
    "%s remains explicitly staff-only",
    (methodName) => {
      expect(visibilityFor(methodName)).toBe(CmsRouteVisibility.STAFF_ONLY);
    },
  );
});
