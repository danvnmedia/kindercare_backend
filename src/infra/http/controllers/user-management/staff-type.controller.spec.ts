import "reflect-metadata";
import { GUARDS_METADATA } from "@nestjs/common/constants";

import { User } from "@/domain/user-management/user.entity";

import { CAMPUS_ID_HEADER, REQUIRE_CAMPUS_ACCESS_KEY } from "../../decorators";
import { PERMISSIONS_KEY } from "../../decorators/permissions.decorator";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { PermissionsGuard } from "../../guards/permissions.guard";
import { StaffTypeController } from "./staff-type.controller";

function handler(name: keyof StaffTypeController) {
  return StaffTypeController.prototype[name];
}

function permissionsFor(name: keyof StaffTypeController): string[] | undefined {
  return Reflect.getMetadata(PERMISSIONS_KEY, handler(name));
}

function guardsFor(name: keyof StaffTypeController): unknown[] {
  return Reflect.getMetadata(GUARDS_METADATA, handler(name)) ?? [];
}

function campusMetadataFor(name: keyof StaffTypeController): unknown {
  return Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler(name));
}

function buildActor(): User {
  return User.reconstitute(
    {
      clerkUid: "user_stafftypeactor",
      isActive: true,
      profile: {
        type: "staff",
        id: "actor-profile-1",
        fullName: "Alice Nguyen",
        email: null,
        phoneNumber: null,
        dateOfBirth: null,
        gender: null,
      },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    "actor-1",
  );
}

describe("StaffTypeController RBAC route metadata", () => {
  it("requires Clerk auth at controller level", () => {
    const classGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      StaffTypeController,
    );
    expect(classGuards).toContain(ClerkAuthGuard);
  });

  it.each([
    ["create", ["staff_type.create"]],
    ["reorder", ["staff_type.update"]],
    ["findAll", ["staff_type.list"]],
    ["findById", ["staff_type.read"]],
    ["update", ["staff_type.update"]],
    ["delete", ["staff_type.delete"]],
  ] as Array<[keyof StaffTypeController, string[]]>)(
    "%s requires expected StaffType permission metadata and PermissionsGuard",
    (methodName, expectedPermissions) => {
      expect(permissionsFor(methodName)).toEqual(expectedPermissions);
      expect(guardsFor(methodName)).toContain(PermissionsGuard);
    },
  );

  it.each([
    "create",
    "reorder",
    "findAll",
    "findById",
    "update",
    "delete",
  ] as Array<keyof StaffTypeController>)(
    "%s requires campus context",
    (methodName) => {
      expect(campusMetadataFor(methodName)).toEqual({});
    },
  );

  it("keeps the campus header documented for every route", () => {
    expect(CAMPUS_ID_HEADER).toBe("x-campus-id");
  });
});

describe("StaffTypeController use-case reachability", () => {
  const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
  const STAFF_TYPE_ID = "22222222-2222-4222-a222-222222222222";

  let actor: User;
  let response: Record<string, unknown>;
  let useCases: {
    create: { execute: jest.Mock };
    getById: { execute: jest.Mock };
    getAll: { execute: jest.Mock };
    update: { execute: jest.Mock };
    delete: { execute: jest.Mock };
    reorder: { execute: jest.Mock };
  };
  let controller: StaffTypeController;

  beforeEach(() => {
    actor = buildActor();
    response = {
      id: STAFF_TYPE_ID,
      campusId: CAMPUS_ID,
      name: "Teacher",
      description: null,
      defaultRoleId: null,
      isArchived: false,
      order: 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    useCases = {
      create: { execute: jest.fn().mockResolvedValue(response) },
      getById: { execute: jest.fn().mockResolvedValue(response) },
      getAll: { execute: jest.fn().mockResolvedValue({ data: [response] }) },
      update: { execute: jest.fn().mockResolvedValue(response) },
      delete: { execute: jest.fn().mockResolvedValue(response) },
      reorder: { execute: jest.fn().mockResolvedValue([response]) },
    };

    controller = new StaffTypeController(
      useCases.create as never,
      useCases.getById as never,
      useCases.getAll as never,
      useCases.update as never,
      useCases.delete as never,
      useCases.reorder as never,
    );
  });

  it("passes campus and actor to mutation use cases without reshaping responses", async () => {
    await expect(
      controller.create(CAMPUS_ID, { name: "Teacher" }, actor),
    ).resolves.toBe(response);
    expect(useCases.create.execute).toHaveBeenCalledWith(
      { name: "Teacher", campusId: CAMPUS_ID },
      actor,
    );

    await expect(
      controller.update(
        STAFF_TYPE_ID,
        { name: "Lead Teacher" },
        CAMPUS_ID,
        actor,
      ),
    ).resolves.toBe(response);
    expect(useCases.update.execute).toHaveBeenCalledWith(
      STAFF_TYPE_ID,
      { name: "Lead Teacher", campusId: CAMPUS_ID },
      actor,
    );

    await expect(
      controller.delete(STAFF_TYPE_ID, CAMPUS_ID, actor),
    ).resolves.toBe(response);
    expect(useCases.delete.execute).toHaveBeenCalledWith(
      STAFF_TYPE_ID,
      { campusId: CAMPUS_ID },
      actor,
    );

    await expect(
      controller.reorder(CAMPUS_ID, { ids: [STAFF_TYPE_ID] }, actor),
    ).resolves.toEqual([response]);
    expect(useCases.reorder.execute).toHaveBeenCalledWith(
      { campusId: CAMPUS_ID, ids: [STAFF_TYPE_ID] },
      actor,
    );
  });

  it("passes campus to read/list use cases without emitting actor context", async () => {
    await expect(controller.findById(STAFF_TYPE_ID, CAMPUS_ID)).resolves.toBe(
      response,
    );
    expect(useCases.getById.execute).toHaveBeenCalledWith(
      STAFF_TYPE_ID,
      CAMPUS_ID,
    );

    const query = { limit: 10, offset: 0 };
    await controller.findAll(CAMPUS_ID, query);
    expect(useCases.getAll.execute).toHaveBeenCalledWith({
      campusId: CAMPUS_ID,
      params: query,
    });
  });
});
