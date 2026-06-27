import "reflect-metadata";
import { GUARDS_METADATA } from "@nestjs/common/constants";

import { REQUIRE_CAMPUS_ACCESS_KEY } from "../../decorators";
import { CampusGuard } from "../../guards/campus.guard";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { HydrateCurrentUserGuard } from "../../guards/hydrate-current-user.guard";
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

describe("GuardianController self-service route metadata", () => {
  it("requires Clerk auth at controller level", () => {
    const classGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      GuardianController,
    );

    expect(classGuards).toContain(ClerkAuthGuard);
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
