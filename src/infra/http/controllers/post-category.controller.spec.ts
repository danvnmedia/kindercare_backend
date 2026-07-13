import "reflect-metadata";
import { HttpStatus, ParseUUIDPipe, RequestMethod } from "@nestjs/common";
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  ROUTE_ARGS_METADATA,
} from "@nestjs/common/constants";
import { DECORATORS } from "@nestjs/swagger";

import { REQUIRE_CAMPUS_ACCESS_KEY } from "../decorators";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { PostCategoryController } from "./post-category.controller";

function handler(name: keyof PostCategoryController) {
  return PostCategoryController.prototype[name];
}

function permissionsFor(
  name: keyof PostCategoryController,
): string[] | undefined {
  return Reflect.getMetadata(PERMISSIONS_KEY, handler(name));
}

function guardsFor(name: keyof PostCategoryController): unknown[] {
  return Reflect.getMetadata(GUARDS_METADATA, handler(name)) ?? [];
}

function campusMetadataFor(name: keyof PostCategoryController): unknown {
  return Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler(name));
}

function idParamPipeFor(name: "update" | "delete"): ParseUUIDPipe | undefined {
  const args = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    PostCategoryController,
    name,
  ) as Record<string, { data?: string; pipes?: unknown[] }> | undefined;
  const idParam = Object.values(args ?? {}).find((arg) => arg.data === "id");
  return idParam?.pipes?.find(
    (pipe): pipe is ParseUUIDPipe => pipe instanceof ParseUUIDPipe,
  );
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
    ["findAll", ["post.create", "post.list", "post.manage"]],
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

  it.each(["findAll", "create", "update", "delete", "reorder"] as Array<
    keyof PostCategoryController
  >)("%s requires campus context", (methodName) => {
    expect(campusMetadataFor(methodName)).toEqual({});
  });

  it.each(["create", "reorder"] as const)(
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

  it.each(["update", "delete"] as const)(
    "%s validates category IDs as UUID v4",
    (methodName) => {
      const pipe = idParamPipeFor(methodName);

      expect(pipe).toBeInstanceOf(ParseUUIDPipe);
      expect((pipe as unknown as { version: string }).version).toBe("4");
    },
  );
});
