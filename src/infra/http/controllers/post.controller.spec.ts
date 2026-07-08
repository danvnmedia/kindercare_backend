import "reflect-metadata";
import { GUARDS_METADATA } from "@nestjs/common/constants";

import { REQUIRE_CAMPUS_ACCESS_KEY } from "../decorators";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
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
  ] as Array<keyof PostController>)("%s requires campus context", (methodName) => {
    expect(campusMetadataFor(methodName)).toEqual({});
  });
});
