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
import { MedicationRequestController } from "./medication-request.controller";

function handler(name: keyof MedicationRequestController) {
  return MedicationRequestController.prototype[name];
}

function guardsFor(name: keyof MedicationRequestController): unknown[] {
  return Reflect.getMetadata(GUARDS_METADATA, handler(name)) ?? [];
}

function permissionsFor(name: keyof MedicationRequestController): string[] {
  return Reflect.getMetadata(PERMISSIONS_KEY, handler(name)) ?? [];
}

describe("MedicationRequestController route metadata", () => {
  it("requires Clerk auth at controller level", () => {
    const classGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      MedicationRequestController,
    );

    expect(classGuards).toContain(ClerkAuthGuard);
  });

  it("wires staff list with campus access and list permission", () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler("findAll"))).toBe("/");
    expect(Reflect.getMetadata(METHOD_METADATA, handler("findAll"))).toBe(
      RequestMethod.GET,
    );
    expect(
      Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler("findAll")),
    ).toEqual({});
    expect(guardsFor("findAll")).toEqual([CampusGuard, PermissionsGuard]);
    expect(permissionsFor("findAll")).toEqual(["medication_request.list"]);
  });

  it("wires staff detail with campus access and read permission", () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler("findOne"))).toBe(
      ":requestId",
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler("findOne"))).toBe(
      RequestMethod.GET,
    );
    expect(
      Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler("findOne")),
    ).toEqual({});
    expect(guardsFor("findOne")).toEqual([CampusGuard, PermissionsGuard]);
    expect(permissionsFor("findOne")).toEqual(["medication_request.read"]);
  });

  it("wires staff review with campus access and update permission", () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler("review"))).toBe(
      ":requestId/review",
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler("review"))).toBe(
      RequestMethod.POST,
    );
    expect(
      Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler("review")),
    ).toEqual({});
    expect(guardsFor("review")).toEqual([CampusGuard, PermissionsGuard]);
    expect(permissionsFor("review")).toEqual(["medication_request.update"]);
  });
});
