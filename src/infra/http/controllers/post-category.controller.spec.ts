import "reflect-metadata";
import { GUARDS_METADATA } from "@nestjs/common/constants";

import { REQUIRE_CAMPUS_ACCESS_KEY } from "../decorators";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { PostCategoryController } from "./post-category.controller";

function handler(name: keyof PostCategoryController) {
  return PostCategoryController.prototype[name];
}

function permissionsFor(name: keyof PostCategoryController): string[] | undefined {
  return Reflect.getMetadata(PERMISSIONS_KEY, handler(name));
}

function guardsFor(name: keyof PostCategoryController): unknown[] {
  return Reflect.getMetadata(GUARDS_METADATA, handler(name)) ?? [];
}

function campusMetadataFor(name: keyof PostCategoryController): unknown {
  return Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler(name));
}

describe("PostCategoryController RBAC route metadata", () => {
  it("requires Clerk auth at controller level", () => {
    const classGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      PostCategoryController,
    );

    expect(classGuards).toContain(ClerkAuthGuard);
  });

  it.each([
    ["findAll", ["post.list", "post.manage"]],
    ["create", ["post.manage"]],
    ["update", ["post.manage"]],
    ["delete", ["post.manage"]],
    ["reorder", ["post.manage"]],
  ] as Array<[keyof PostCategoryController, string[]]>)(
    "%s requires expected post-category permission metadata and PermissionsGuard",
    (methodName, expectedPermissions) => {
      expect(permissionsFor(methodName)).toEqual(expectedPermissions);
      expect(guardsFor(methodName)).toContain(PermissionsGuard);
    },
  );

  it.each([
    "findAll",
    "create",
    "update",
    "delete",
    "reorder",
  ] as Array<keyof PostCategoryController>)(
    "%s requires campus context",
    (methodName) => {
      expect(campusMetadataFor(methodName)).toEqual({});
    },
  );
});
