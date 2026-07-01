import "reflect-metadata";
import { GUARDS_METADATA } from "@nestjs/common/constants";

import { REQUIRE_CAMPUS_ACCESS_KEY } from "../decorators";
import { CampusGuard } from "../guards/campus.guard";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { HydrateCurrentUserGuard } from "../guards/hydrate-current-user.guard";
import { ParentMedicationRequestController } from "./parent-medication-request.controller";

function handler(name: keyof ParentMedicationRequestController) {
  return ParentMedicationRequestController.prototype[name];
}

function guardsFor(name: keyof ParentMedicationRequestController): unknown[] {
  return Reflect.getMetadata(GUARDS_METADATA, handler(name)) ?? [];
}

function campusMetadataFor(
  name: keyof ParentMedicationRequestController,
): unknown {
  return Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler(name));
}

describe("ParentMedicationRequestController route metadata", () => {
  it("requires Clerk auth at controller level", () => {
    const classGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      ParentMedicationRequestController,
    );

    expect(classGuards).toContain(ClerkAuthGuard);
  });

  it("hydrates current user while bypassing campus role access for parent routes", () => {
    const parentRouteNames: Array<keyof ParentMedicationRequestController> = [
      "getMine",
      "create",
      "findOne",
      "cancel",
      "respond",
    ];

    for (const routeName of parentRouteNames) {
      expect(campusMetadataFor(routeName)).toEqual({
        checkUserAccess: false,
      });
      expect(guardsFor(routeName)).toEqual([
        CampusGuard,
        HydrateCurrentUserGuard,
      ]);
    }
  });
});
