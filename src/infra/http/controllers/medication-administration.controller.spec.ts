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
import { MedicationAdministrationController } from "./medication-administration.controller";

function handler(name: keyof MedicationAdministrationController) {
  return MedicationAdministrationController.prototype[name];
}

function guardsFor(name: keyof MedicationAdministrationController): unknown[] {
  return Reflect.getMetadata(GUARDS_METADATA, handler(name)) ?? [];
}

function permissionsFor(
  name: keyof MedicationAdministrationController,
): string[] {
  return Reflect.getMetadata(PERMISSIONS_KEY, handler(name)) ?? [];
}

describe("MedicationAdministrationController route metadata", () => {
  it("requires Clerk auth at controller level", () => {
    const classGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      MedicationAdministrationController,
    );

    expect(classGuards).toContain(ClerkAuthGuard);
  });

  it("wires daily queue with campus access and read permission", () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler("daily"))).toBe("daily");
    expect(Reflect.getMetadata(METHOD_METADATA, handler("daily"))).toBe(
      RequestMethod.GET,
    );
    expect(
      Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler("daily")),
    ).toEqual({});
    expect(guardsFor("daily")).toEqual([CampusGuard, PermissionsGuard]);
    expect(permissionsFor("daily")).toEqual(["medication_administration.read"]);
  });

  it("wires record with campus access and record/correction permissions", () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler("record"))).toBe(
      ":occurrenceId/record",
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler("record"))).toBe(
      RequestMethod.POST,
    );
    expect(
      Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler("record")),
    ).toEqual({});
    expect(guardsFor("record")).toEqual([CampusGuard, PermissionsGuard]);
    expect(permissionsFor("record")).toEqual([
      "medication_administration.create",
      "medication_administration.update",
    ]);
  });
});
