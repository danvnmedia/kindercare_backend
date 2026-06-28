import "reflect-metadata";
import { GUARDS_METADATA } from "@nestjs/common/constants";

import { REQUIRE_CAMPUS_ACCESS_KEY } from "../decorators";
import { CampusGuard } from "../guards/campus.guard";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { HydrateCurrentUserGuard } from "../guards/hydrate-current-user.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { AbsenceRequestController } from "./absence-request.controller";

function handler(name: keyof AbsenceRequestController) {
  return AbsenceRequestController.prototype[name];
}

function guardsFor(name: keyof AbsenceRequestController): unknown[] {
  return Reflect.getMetadata(GUARDS_METADATA, handler(name)) ?? [];
}

function campusMetadataFor(name: keyof AbsenceRequestController): unknown {
  return Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler(name));
}

describe("AbsenceRequestController route metadata", () => {
  it("requires Clerk auth at controller level", () => {
    const classGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      AbsenceRequestController,
    );

    expect(classGuards).toContain(ClerkAuthGuard);
  });

  it.each(["create", "getMine"] as Array<keyof AbsenceRequestController>)(
    "%s hydrates current user while bypassing campus role access",
    (methodName) => {
      expect(campusMetadataFor(methodName)).toEqual({
        checkUserAccess: false,
      });
      expect(guardsFor(methodName)).toEqual([
        CampusGuard,
        HydrateCurrentUserGuard,
      ]);
    },
  );

  it.each(["findAll", "findOne", "review"] as Array<
    keyof AbsenceRequestController
  >)("%s keeps admin permission guard", (methodName) => {
    expect(campusMetadataFor(methodName)).toEqual({});
    expect(guardsFor(methodName)).toContain(PermissionsGuard);
    expect(guardsFor(methodName)).not.toContain(HydrateCurrentUserGuard);
  });
});
