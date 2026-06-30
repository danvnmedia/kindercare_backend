import "reflect-metadata";
import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";

import { REQUIRE_CAMPUS_ACCESS_KEY } from "../../decorators";
import { CampusGuard } from "../../guards/campus.guard";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { HydrateCurrentUserGuard } from "../../guards/hydrate-current-user.guard";
import { createUser } from "@/test-utils/entity-factories";
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
});
