import "reflect-metadata";
import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";

import { Gender } from "@/domain/user-management/enums/gender.enum";
import { createUser } from "@/test-utils/entity-factories";
import { REQUIRE_CAMPUS_ACCESS_KEY } from "../../decorators";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { HydrateCurrentUserGuard } from "../../guards/hydrate-current-user.guard";
import { StaffController } from "./staff.controller";

function handler(name: keyof StaffController) {
  return StaffController.prototype[name];
}

function guardsFor(name: keyof StaffController): unknown[] {
  return Reflect.getMetadata(GUARDS_METADATA, handler(name)) ?? [];
}

function campusMetadataFor(name: keyof StaffController): unknown {
  return Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler(name));
}

function routePathFor(name: keyof StaffController): unknown {
  return Reflect.getMetadata(PATH_METADATA, handler(name));
}

describe("StaffController route metadata", () => {
  it("requires Clerk auth at controller level", () => {
    const classGuards = Reflect.getMetadata(GUARDS_METADATA, StaffController);

    expect(classGuards).toContain(ClerkAuthGuard);
  });

  it("adds create-or-attach on the normal campus access path", () => {
    expect(routePathFor("createOrAttach")).toBe("create-or-attach");
    expect(campusMetadataFor("createOrAttach")).toEqual({});
    expect(guardsFor("createOrAttach")).not.toContain(HydrateCurrentUserGuard);
  });

  it("delegates createOrAttach with campus and current user context", async () => {
    const currentUser = createUser();
    const createOrAttachStaffUseCase = {
      execute: jest.fn().mockResolvedValue({}),
    };
    const unused = {} as never;
    const controller = new StaffController(
      unused,
      createOrAttachStaffUseCase as never,
      unused,
      unused,
      unused,
      unused,
      unused,
    );

    await controller.createOrAttach(
      "campus-1",
      {
        fullName: "Dan Le",
        email: "dan@example.com",
        phoneNumber: "+84900000002",
        gender: Gender.MALE,
        staffTypeIds: ["staff-type-1"],
      },
      currentUser,
    );

    expect(createOrAttachStaffUseCase.execute).toHaveBeenCalledWith(
      {
        campusId: "campus-1",
        fullName: "Dan Le",
        email: "dan@example.com",
        phoneNumber: "+84900000002",
        staffTypeIds: ["staff-type-1"],
        address: undefined,
        dateOfBirth: undefined,
        gender: Gender.MALE,
      },
      currentUser,
    );
  });

  it("keeps POST /staff create-new only at the controller boundary", async () => {
    const currentUser = createUser();
    const createStaffUseCase = {
      execute: jest.fn().mockResolvedValue({}),
    };
    const createOrAttachStaffUseCase = {
      execute: jest.fn().mockResolvedValue({}),
    };
    const unused = {} as never;
    const controller = new StaffController(
      createStaffUseCase as never,
      createOrAttachStaffUseCase as never,
      unused,
      unused,
      unused,
      unused,
      unused,
    );

    await controller.create(
      "campus-1",
      {
        fullName: "Dan Le",
        email: "dan@example.com",
        phoneNumber: "+84900000002",
        gender: Gender.MALE,
        staffTypeIds: ["staff-type-1"],
      },
      currentUser,
    );

    expect(createStaffUseCase.execute).toHaveBeenCalledTimes(1);
    expect(createOrAttachStaffUseCase.execute).not.toHaveBeenCalled();
  });

  it("does not add a staff-specific current-user campus discovery route", () => {
    const routePaths = Object.getOwnPropertyNames(StaffController.prototype)
      .filter((name) => name !== "constructor")
      .map((name) =>
        Reflect.getMetadata(
          PATH_METADATA,
          StaffController.prototype[name as keyof StaffController],
        ),
      );

    expect(routePaths).not.toContain("me/campuses");
  });
});
