import "reflect-metadata";
import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";

import { REQUIRE_CAMPUS_ACCESS_KEY } from "../../decorators";
import { CampusGuard } from "../../guards/campus.guard";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { HydrateCurrentUserGuard } from "../../guards/hydrate-current-user.guard";
import { createUser } from "@/test-utils/entity-factories";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { GuardianController } from "./guardian.controller";

function handler(name: keyof GuardianController) {
  return GuardianController.prototype[name];
}

function guardsFor(name: keyof GuardianController): unknown[] {
  return Reflect.getMetadata(GUARDS_METADATA, handler(name)) ?? [];
}

function campusMetadataFor(name: keyof GuardianController): unknown {
  return Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler(name));
}

function routePathFor(name: keyof GuardianController): unknown {
  return Reflect.getMetadata(PATH_METADATA, handler(name));
}

describe("GuardianController self-service route metadata", () => {
  it("requires Clerk auth at controller level", () => {
    const classGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      GuardianController,
    );

    expect(classGuards).toContain(ClerkAuthGuard);
  });

  it("hydrates current user for getMyCampuses without requiring campus role access", () => {
    expect(routePathFor("getMyCampuses")).toBe("me/campuses");
    expect(campusMetadataFor("getMyCampuses")).toBeUndefined();
    expect(guardsFor("getMyCampuses")).toEqual([HydrateCurrentUserGuard]);
  });

  it("delegates getMyCampuses with only the hydrated current user", async () => {
    const currentUser = createUser();
    const getCurrentGuardianCampusesUseCase = {
      execute: jest.fn().mockResolvedValue([]),
    };
    const unused = {} as never;
    const controller = new GuardianController(
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      getCurrentGuardianCampusesUseCase as never,
      unused,
    );

    await controller.getMyCampuses(currentUser);

    expect(getCurrentGuardianCampusesUseCase.execute).toHaveBeenCalledWith(
      currentUser,
    );
  });

  it("hydrates current user for getMyStudents while bypassing campus role access", () => {
    expect(campusMetadataFor("getMyStudents")).toEqual({
      checkUserAccess: false,
    });
    expect(guardsFor("getMyStudents")).toEqual([
      CampusGuard,
      HydrateCurrentUserGuard,
    ]);
  });

  it("keeps admin guardian routes on the normal campus access path", () => {
    expect(campusMetadataFor("findAll")).toEqual({});
    expect(guardsFor("findAll")).not.toContain(HydrateCurrentUserGuard);
  });

  it("adds create-or-attach on the normal campus access path", () => {
    expect(routePathFor("createOrAttach")).toBe("create-or-attach");
    expect(campusMetadataFor("createOrAttach")).toEqual({});
    expect(guardsFor("createOrAttach")).not.toContain(HydrateCurrentUserGuard);
  });

  it("delegates createOrAttach with campus and current user context", async () => {
    const currentUser = createUser();
    const createOrAttachGuardianUseCase = {
      execute: jest.fn().mockResolvedValue({}),
    };
    const unused = {} as never;
    const controller = new GuardianController(
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      createOrAttachGuardianUseCase as never,
    );

    await controller.createOrAttach(
      "campus-1",
      {
        fullName: "Carol Pham",
        email: "carol@example.com",
        phoneNumber: "+84900000001",
        gender: Gender.FEMALE,
      },
      currentUser,
    );

    expect(createOrAttachGuardianUseCase.execute).toHaveBeenCalledWith(
      {
        campusId: "campus-1",
        fullName: "Carol Pham",
        dateOfBirth: undefined,
        email: "carol@example.com",
        phoneNumber: "+84900000001",
        occupation: undefined,
        workAddress: undefined,
        address: undefined,
        gender: Gender.FEMALE,
      },
      currentUser,
    );
  });
});
