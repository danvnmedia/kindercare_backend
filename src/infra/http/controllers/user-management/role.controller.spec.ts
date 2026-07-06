import "reflect-metadata";
import { GUARDS_METADATA } from "@nestjs/common/constants";

import { REQUIRE_CAMPUS_ACCESS_KEY } from "../../decorators";
import { PERMISSIONS_KEY } from "../../decorators/permissions.decorator";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { PermissionsGuard } from "../../guards/permissions.guard";
import { RoleController } from "./role.controller";

function handler(name: keyof RoleController) {
  return RoleController.prototype[name];
}

function permissionsFor(name: keyof RoleController): string[] | undefined {
  return Reflect.getMetadata(PERMISSIONS_KEY, handler(name));
}

function guardsFor(name: keyof RoleController): unknown[] {
  return Reflect.getMetadata(GUARDS_METADATA, handler(name)) ?? [];
}

function campusMetadataFor(name: keyof RoleController): unknown {
  return Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler(name));
}

describe("RoleController RBAC admin route metadata", () => {
  it("requires Clerk auth at controller level", () => {
    const classGuards = Reflect.getMetadata(GUARDS_METADATA, RoleController);
    expect(classGuards).toContain(ClerkAuthGuard);
  });

  it.each([
    ["findAll", ["role.list"]],
    ["getAllPermissions", ["role.read"]],
    ["findOne", ["role.read"]],
    ["create", ["role.create"]],
    ["update", ["role.update"]],
    ["remove", ["role.delete"]],
    ["assignPermissions", ["role.update"]],
    ["replacePermissions", ["role.update"]],
    ["removePermissions", ["role.update"]],
    ["getMembers", ["role.read", "role.assign"]],
    ["assignUsers", ["role.assign"]],
    ["removeUsers", ["role.assign"]],
  ] as Array<[keyof RoleController, string[]]>)(
    "%s requires expected role permission metadata and PermissionsGuard",
    (methodName, expectedPermissions) => {
      expect(permissionsFor(methodName)).toEqual(expectedPermissions);
      expect(guardsFor(methodName)).toContain(PermissionsGuard);
    },
  );

  it.each([
    "findAll",
    "getAllPermissions",
    "findOne",
    "create",
    "update",
    "remove",
    "assignPermissions",
    "replacePermissions",
    "removePermissions",
    "getMembers",
    "assignUsers",
    "removeUsers",
  ] as Array<keyof RoleController>)(
    "%s requires campus context",
    (methodName) => {
      expect(campusMetadataFor(methodName)).toEqual({});
    },
  );

  it("keeps the explicit global audit read route out of campus context", () => {
    expect(permissionsFor("findGlobalAudit")).toEqual(["role.list"]);
    expect(guardsFor("findGlobalAudit")).toContain(PermissionsGuard);
    expect(campusMetadataFor("findGlobalAudit")).toBeUndefined();
  });
});
