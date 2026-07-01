import "reflect-metadata";
import { RequestMethod } from "@nestjs/common";
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";

import { REQUIRE_CAMPUS_ACCESS_KEY } from "../decorators";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { CampusGuard } from "../guards/campus.guard";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { HealthCenterMedicationSummaryController } from "./health-center-medication-summary.controller";

function handler(name: keyof HealthCenterMedicationSummaryController) {
  return HealthCenterMedicationSummaryController.prototype[name];
}

describe("HealthCenterMedicationSummaryController route metadata", () => {
  it("requires Clerk auth at controller level", () => {
    const classGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      HealthCenterMedicationSummaryController,
    );

    expect(classGuards).toContain(ClerkAuthGuard);
  });

  it("wires GET /health-center/medication-summary with medication read permission", () => {
    const routeHandler = handler("getSummary");

    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        HealthCenterMedicationSummaryController,
      ),
    ).toBe("health-center");
    expect(Reflect.getMetadata(PATH_METADATA, routeHandler)).toBe(
      "medication-summary",
    );
    expect(Reflect.getMetadata(METHOD_METADATA, routeHandler)).toBe(
      RequestMethod.GET,
    );
    expect(
      Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, routeHandler),
    ).toEqual({});
    expect(Reflect.getMetadata(GUARDS_METADATA, routeHandler)).toEqual([
      CampusGuard,
      PermissionsGuard,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, routeHandler)).toEqual([
      "medication_request.read",
    ]);
  });
});
