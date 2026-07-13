import "reflect-metadata";
import { HttpStatus, RequestMethod } from "@nestjs/common";
import { HTTP_CODE_METADATA, METHOD_METADATA } from "@nestjs/common/constants";
import { DECORATORS } from "@nestjs/swagger";

import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import {
  createPermission,
  createRole,
  createRoleAssignment,
  createUser,
  DEFAULT_CAMPUS_ID_A,
  DEFAULT_CAMPUS_ID_B,
} from "@/test-utils";
import { FileController } from "./file.controller";

function handler(name: keyof FileController) {
  return FileController.prototype[name];
}

describe("FileController response metadata", () => {
  it.each([
    ["file.delete", false],
    ["file.manage", true],
  ])("maps %s to canDeleteAny=%s", async (permissionId, canDeleteAny) => {
    const deleteFile = {
      execute: jest.fn().mockResolvedValue({ isLeft: () => false }),
    };
    const controller = new FileController(
      {} as never,
      deleteFile as never,
      {} as never,
      {} as never,
    );
    const user = createUser({
      id: "33333333-3333-4333-a333-333333333333",
      roleAssignments: [
        createRoleAssignment(
          createRole({
            campusId: DEFAULT_CAMPUS_ID_A,
            permissions: [
              createPermission({ id: permissionId, module: "file" }),
            ],
          }),
          DEFAULT_CAMPUS_ID_A,
        ),
      ],
    });

    await controller.delete(
      "55555555-5555-4555-a555-555555555555",
      user,
      DEFAULT_CAMPUS_ID_A,
    );

    expect(deleteFile.execute).toHaveBeenCalledWith(
      expect.objectContaining({ canDeleteAny }),
    );
  });

  it("does not let a campus A system role elevate delete-any in campus B", async () => {
    const deleteFile = {
      execute: jest.fn().mockResolvedValue({ isLeft: () => false }),
    };
    const controller = new FileController(
      {} as never,
      deleteFile as never,
      {} as never,
      {} as never,
    );
    const user = createUser({
      roleAssignments: [
        createRoleAssignment(
          createRole({
            campusId: DEFAULT_CAMPUS_ID_A,
            isSystemRole: true,
          }),
          DEFAULT_CAMPUS_ID_A,
        ),
        createRoleAssignment(
          createRole({
            campusId: DEFAULT_CAMPUS_ID_B,
            permissions: [
              createPermission({ id: "file.delete", module: "file" }),
            ],
          }),
          DEFAULT_CAMPUS_ID_B,
        ),
      ],
    });

    await controller.delete(
      "55555555-5555-4555-a555-555555555555",
      user,
      DEFAULT_CAMPUS_ID_B,
    );

    expect(deleteFile.execute).toHaveBeenCalledWith(
      expect.objectContaining({ canDeleteAny: false }),
    );
  });

  it("allows a globally assigned system role to delete-any in campus B", async () => {
    const deleteFile = {
      execute: jest.fn().mockResolvedValue({ isLeft: () => false }),
    };
    const controller = new FileController(
      {} as never,
      deleteFile as never,
      {} as never,
      {} as never,
    );
    const user = createUser({
      roleAssignments: [
        createRoleAssignment(createRole({ isSystemRole: true })),
        createRoleAssignment(
          createRole({
            campusId: DEFAULT_CAMPUS_ID_B,
            permissions: [
              createPermission({ id: "file.delete", module: "file" }),
            ],
          }),
          DEFAULT_CAMPUS_ID_B,
        ),
      ],
    });

    await controller.delete(
      "55555555-5555-4555-a555-555555555555",
      user,
      DEFAULT_CAMPUS_ID_B,
    );

    expect(deleteFile.execute).toHaveBeenCalledWith(
      expect.objectContaining({ canDeleteAny: true }),
    );
  });

  it("keeps owner delete and elevated file.manage as distinct authorities", () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler("delete"))).toEqual([
      "file.delete",
      "file.manage",
    ]);
  });

  it.each(["initiateUpload", "completeUpload"] as Array<keyof FileController>)(
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
});
