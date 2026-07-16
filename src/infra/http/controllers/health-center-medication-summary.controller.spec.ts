import "reflect-metadata";
import { RequestMethod } from "@nestjs/common";
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";
import { DECORATORS } from "@nestjs/swagger";

import { REQUIRE_CAMPUS_ACCESS_KEY } from "../decorators";
import { REQUIRED_ALL_PERMISSIONS_KEY } from "../decorators/require-all-permissions.decorator";
import { AllPermissionsGuard } from "../guards/all-permissions.guard";
import { CampusGuard } from "../guards/campus.guard";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
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

  it("wires GET /health-center/medication-summary with both medication read permissions", () => {
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
      AllPermissionsGuard,
    ]);
    expect(
      Reflect.getMetadata(REQUIRED_ALL_PERMISSIONS_KEY, routeHandler),
    ).toEqual(["medication_request.read", "medication_administration.read"]);
    expect(Reflect.getMetadata(DECORATORS.API_OPERATION, routeHandler)).toEqual(
      expect.objectContaining({ deprecated: true }),
    );
  });
});
