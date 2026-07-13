import "reflect-metadata";
import { GUARDS_METADATA } from "@nestjs/common/constants";

import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { REQUIRE_CAMPUS_ACCESS_KEY } from "../decorators";
import { CampusGuard } from "../guards/campus.guard";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { AttendanceController } from "./attendance.controller";

function handler(name: keyof AttendanceController) {
  return AttendanceController.prototype[name];
}

function guardsFor(name: keyof AttendanceController): unknown[] {
  return Reflect.getMetadata(GUARDS_METADATA, handler(name)) ?? [];
}

function campusMetadataFor(name: keyof AttendanceController): unknown {
  return Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler(name));
}

function permissionsFor(name: keyof AttendanceController): unknown {
  return Reflect.getMetadata(PERMISSIONS_KEY, handler(name));
}

describe("AttendanceController route metadata", () => {
  it("requires Clerk auth at controller level", () => {
    const classGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      AttendanceController,
    );

    expect(classGuards).toContain(ClerkAuthGuard);
  });

  it("keeps roll-call read campus-scoped and RBAC-gated", () => {
    expect(campusMetadataFor("getClassRollCall")).toEqual({});
    expect(guardsFor("getClassRollCall")).toContain(CampusGuard);
    expect(guardsFor("getClassRollCall")).toContain(PermissionsGuard);
    expect(permissionsFor("getClassRollCall")).toEqual([
      "attendance.read",
      "attendance.list",
    ]);
  });

  it("keeps attendance class options campus-scoped and RBAC-gated", () => {
    expect(campusMetadataFor("getAttendanceClassOptions")).toEqual({});
    expect(guardsFor("getAttendanceClassOptions")).toContain(CampusGuard);
    expect(guardsFor("getAttendanceClassOptions")).toContain(PermissionsGuard);
    expect(permissionsFor("getAttendanceClassOptions")).toEqual([
      "attendance.read",
      "attendance.list",
    ]);
  });

  it("keeps roll-call save campus-scoped and RBAC-gated", () => {
    expect(campusMetadataFor("saveClassRollCall")).toEqual({});
    expect(guardsFor("saveClassRollCall")).toContain(CampusGuard);
    expect(guardsFor("saveClassRollCall")).toContain(PermissionsGuard);
    expect(permissionsFor("saveClassRollCall")).toEqual([
      "attendance.create",
      "attendance.update",
    ]);
  });
});
