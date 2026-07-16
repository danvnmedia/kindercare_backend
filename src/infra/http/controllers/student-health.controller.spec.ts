import "reflect-metadata";
import { RequestMethod } from "@nestjs/common";
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";

import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { REQUIRE_CAMPUS_ACCESS_KEY } from "../decorators";
import { CampusGuard } from "../guards/campus.guard";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { ClassHealthInstructionsController } from "./class-health-instructions.controller";
import { HealthCenterController } from "./health-center.controller";
import { StudentHealthController } from "./student-health.controller";

function handler(name: keyof StudentHealthController) {
  return StudentHealthController.prototype[name];
}

function guardsFor(name: keyof StudentHealthController): unknown[] {
  return Reflect.getMetadata(GUARDS_METADATA, handler(name)) ?? [];
}

function permissionsFor(name: keyof StudentHealthController): string[] {
  return Reflect.getMetadata(PERMISSIONS_KEY, handler(name)) ?? [];
}

describe("StudentHealthController route metadata", () => {
  it("requires Clerk auth at controller level", () => {
    const classGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      StudentHealthController,
    );

    expect(classGuards).toContain(ClerkAuthGuard);
  });

  it("wires GET /students/:studentId/health-profile with read permission", () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler("getProfile"))).toBe(
      ":studentId/health-profile",
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler("getProfile"))).toBe(
      RequestMethod.GET,
    );
    expect(
      Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler("getProfile")),
    ).toEqual({});
    expect(guardsFor("getProfile")).toEqual([CampusGuard, PermissionsGuard]);
    expect(permissionsFor("getProfile")).toEqual(["student_health.read"]);
  });

  it("wires PATCH /students/:studentId/health-profile with update permission", () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler("updateProfile"))).toBe(
      ":studentId/health-profile",
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler("updateProfile"))).toBe(
      RequestMethod.PATCH,
    );
    expect(
      Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler("updateProfile")),
    ).toEqual({});
    expect(guardsFor("updateProfile")).toEqual([CampusGuard, PermissionsGuard]);
    expect(permissionsFor("updateProfile")).toEqual(["student_health.update"]);
  });

  it("wires GET /students/:studentId/medication-history with medication read permission", () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, handler("listMedicationHistory")),
    ).toBe(":studentId/medication-history");
    expect(
      Reflect.getMetadata(METHOD_METADATA, handler("listMedicationHistory")),
    ).toBe(RequestMethod.GET);
    expect(
      Reflect.getMetadata(
        REQUIRE_CAMPUS_ACCESS_KEY,
        handler("listMedicationHistory"),
      ),
    ).toEqual({});
    expect(guardsFor("listMedicationHistory")).toEqual([
      CampusGuard,
      PermissionsGuard,
    ]);
    expect(permissionsFor("listMedicationHistory")).toEqual([
      "medication_request.read",
    ]);
  });

  it("wires GET /students/:studentId/health-checkups with read permission", () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler("listCheckups"))).toBe(
      ":studentId/health-checkups",
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler("listCheckups"))).toBe(
      RequestMethod.GET,
    );
    expect(
      Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler("listCheckups")),
    ).toEqual({});
    expect(guardsFor("listCheckups")).toEqual([CampusGuard, PermissionsGuard]);
    expect(permissionsFor("listCheckups")).toEqual(["student_health.read"]);
  });

  it("wires POST /students/:studentId/health-checkups with create permission", () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler("createCheckup"))).toBe(
      ":studentId/health-checkups",
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler("createCheckup"))).toBe(
      RequestMethod.POST,
    );
    expect(
      Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler("createCheckup")),
    ).toEqual({});
    expect(guardsFor("createCheckup")).toEqual([CampusGuard, PermissionsGuard]);
    expect(permissionsFor("createCheckup")).toEqual(["student_health.create"]);
  });

  it("wires GET /students/:studentId/health-checkups/:checkupId with read permission", () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler("getCheckup"))).toBe(
      ":studentId/health-checkups/:checkupId",
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler("getCheckup"))).toBe(
      RequestMethod.GET,
    );
    expect(
      Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler("getCheckup")),
    ).toEqual({});
    expect(guardsFor("getCheckup")).toEqual([CampusGuard, PermissionsGuard]);
    expect(permissionsFor("getCheckup")).toEqual(["student_health.read"]);
  });

  it("wires PATCH /students/:studentId/health-checkups/:checkupId with update permission", () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler("updateCheckup"))).toBe(
      ":studentId/health-checkups/:checkupId",
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler("updateCheckup"))).toBe(
      RequestMethod.PATCH,
    );
    expect(
      Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler("updateCheckup")),
    ).toEqual({});
    expect(guardsFor("updateCheckup")).toEqual([CampusGuard, PermissionsGuard]);
    expect(permissionsFor("updateCheckup")).toEqual(["student_health.update"]);
  });

  it("wires student health event routes with expected permissions", () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler("listEvents"))).toBe(
      ":studentId/health-events",
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler("listEvents"))).toBe(
      RequestMethod.GET,
    );
    expect(
      Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler("listEvents")),
    ).toEqual({});
    expect(guardsFor("listEvents")).toEqual([CampusGuard, PermissionsGuard]);
    expect(permissionsFor("listEvents")).toEqual(["student_health.read"]);

    expect(Reflect.getMetadata(PATH_METADATA, handler("createEvent"))).toBe(
      ":studentId/health-events",
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler("createEvent"))).toBe(
      RequestMethod.POST,
    );
    expect(guardsFor("createEvent")).toEqual([CampusGuard, PermissionsGuard]);
    expect(permissionsFor("createEvent")).toEqual(["student_health.create"]);

    expect(Reflect.getMetadata(PATH_METADATA, handler("getEvent"))).toBe(
      ":studentId/health-events/:eventId",
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler("getEvent"))).toBe(
      RequestMethod.GET,
    );
    expect(guardsFor("getEvent")).toEqual([CampusGuard, PermissionsGuard]);
    expect(permissionsFor("getEvent")).toEqual(["student_health.read"]);

    expect(Reflect.getMetadata(PATH_METADATA, handler("updateEvent"))).toBe(
      ":studentId/health-events/:eventId",
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler("updateEvent"))).toBe(
      RequestMethod.PATCH,
    );
    expect(guardsFor("updateEvent")).toEqual([CampusGuard, PermissionsGuard]);
    expect(permissionsFor("updateEvent")).toEqual(["student_health.update"]);
  });

  it("wires student health instruction routes with expected permissions", () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, handler("listInstructions")),
    ).toBe(":studentId/health-instructions");
    expect(
      Reflect.getMetadata(METHOD_METADATA, handler("listInstructions")),
    ).toBe(RequestMethod.GET);
    expect(permissionsFor("listInstructions")).toEqual(["student_health.read"]);

    expect(
      Reflect.getMetadata(PATH_METADATA, handler("createInstruction")),
    ).toBe(":studentId/health-instructions");
    expect(
      Reflect.getMetadata(METHOD_METADATA, handler("createInstruction")),
    ).toBe(RequestMethod.POST);
    expect(permissionsFor("createInstruction")).toEqual([
      "student_health.create",
    ]);

    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        handler("getActiveStudentInstructions"),
      ),
    ).toBe(":studentId/health-instructions/active");
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        handler("getActiveStudentInstructions"),
      ),
    ).toBe(RequestMethod.GET);
    expect(permissionsFor("getActiveStudentInstructions")).toEqual([
      "student_health.read",
    ]);

    expect(Reflect.getMetadata(PATH_METADATA, handler("getInstruction"))).toBe(
      ":studentId/health-instructions/:instructionId",
    );
    expect(
      Reflect.getMetadata(METHOD_METADATA, handler("getInstruction")),
    ).toBe(RequestMethod.GET);
    expect(permissionsFor("getInstruction")).toEqual(["student_health.read"]);

    expect(
      Reflect.getMetadata(PATH_METADATA, handler("updateInstruction")),
    ).toBe(":studentId/health-instructions/:instructionId");
    expect(
      Reflect.getMetadata(METHOD_METADATA, handler("updateInstruction")),
    ).toBe(RequestMethod.PATCH);
    expect(permissionsFor("updateInstruction")).toEqual([
      "student_health.update",
    ]);
  });

  it("registers student active instruction route before :instructionId", () => {
    const routeNames = Object.getOwnPropertyNames(
      StudentHealthController.prototype,
    );

    expect(routeNames.indexOf("getActiveStudentInstructions")).toBeLessThan(
      routeNames.indexOf("getInstruction"),
    );
  });

  it.each([
    ["archiveCheckup" as const, ":studentId/health-checkups/:checkupId"],
    ["archiveEvent" as const, ":studentId/health-events/:eventId"],
    [
      "archiveInstruction" as const,
      ":studentId/health-instructions/:instructionId",
    ],
  ])(
    "wires DELETE archive route %s with delete-only permission",
    (name, path) => {
      expect(Reflect.getMetadata(PATH_METADATA, handler(name))).toBe(path);
      expect(Reflect.getMetadata(METHOD_METADATA, handler(name))).toBe(
        RequestMethod.DELETE,
      );
      expect(
        Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler(name)),
      ).toEqual({});
      expect(guardsFor(name)).toEqual([CampusGuard, PermissionsGuard]);
      expect(permissionsFor(name)).toEqual(["student_health.delete"]);
      expect(permissionsFor(name)).not.toContain("student_health.update");
    },
  );
});

describe("ClassHealthInstructionsController route metadata", () => {
  it("requires Clerk auth at controller level", () => {
    const classGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      ClassHealthInstructionsController,
    );

    expect(classGuards).toContain(ClerkAuthGuard);
  });

  it("wires GET /classes/:classId/health-instructions/active with read permission", () => {
    const routeHandler =
      ClassHealthInstructionsController.prototype.getActiveClassInstructions;

    expect(Reflect.getMetadata(PATH_METADATA, routeHandler)).toBe(
      ":classId/health-instructions/active",
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
      "student_health.read",
    ]);
  });
});

describe("HealthCenterController route metadata", () => {
  it("requires Clerk auth at controller level", () => {
    const classGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      HealthCenterController,
    );

    expect(classGuards).toContain(ClerkAuthGuard);
  });

  it("wires GET /health-center/daily-items with permission-aware OR entry", () => {
    const routeHandler = HealthCenterController.prototype.getDailyItems;

    expect(Reflect.getMetadata(PATH_METADATA, HealthCenterController)).toBe(
      "health-center",
    );
    expect(Reflect.getMetadata(PATH_METADATA, routeHandler)).toBe(
      "daily-items",
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
      "student_health.read",
      "medication_administration.read",
      "medication_request.list",
    ]);
  });
});
