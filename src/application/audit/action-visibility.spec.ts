import { AUDIT_ACTIONS, AUDIT_VISIBILITIES } from "@/domain/audit";

import { ACTION_VISIBILITY } from "./action-visibility";

describe("ACTION_VISIBILITY", () => {
  it("contains exactly one entry per AuditAction", () => {
    const mapKeys = Object.keys(ACTION_VISIBILITY).sort();
    const actionKeys = [...AUDIT_ACTIONS].sort();

    expect(mapKeys).toEqual(actionKeys);
    // Belt-and-braces: ensures no duplicate-via-string-coercion sneaks in.
    expect(mapKeys.length).toBe(AUDIT_ACTIONS.length);
  });

  it("defaults every action to 'ADMIN' in v1 (per D5)", () => {
    for (const action of AUDIT_ACTIONS) {
      expect(ACTION_VISIBILITY[action]).toBe("ADMIN");
    }
  });

  it("only maps to known AuditVisibility values", () => {
    const valid = new Set<string>(AUDIT_VISIBILITIES);
    for (const value of Object.values(ACTION_VISIBILITY)) {
      expect(valid.has(value)).toBe(true);
    }
  });
});

describe("GRANT_ROLE / REVOKE_ROLE vocab additions (direct-role-assignment-via-uow)", () => {
  it("registers both actions in AUDIT_ACTIONS", () => {
    // Lockdown by name. The parameterized "one entry per AuditAction" test
    // above already covers these universally — this guards against accidental
    // removal of these two specific named members, which the FE action-list
    // export and the AuditEventRecorder literal-union both depend on.
    expect(AUDIT_ACTIONS).toContain("GRANT_ROLE");
    expect(AUDIT_ACTIONS).toContain("REVOKE_ROLE");
  });

  it("maps both to ADMIN visibility (D2 of direct-role-assignment-via-uow)", () => {
    expect(ACTION_VISIBILITY.GRANT_ROLE).toBe("ADMIN");
    expect(ACTION_VISIBILITY.REVOKE_ROLE).toBe("ADMIN");
  });
});

describe("meal-menu audit vocab additions", () => {
  const mealMenuActions = [
    "CREATE_MEAL_MENU",
    "COPY_MEAL_MENU",
    "UPDATE_MEAL_MENU",
    "ARCHIVE_MEAL_MENU",
    "RESTORE_MEAL_MENU",
    "UPDATE_MEAL_MENU_CONFIG",
  ] as const;

  it("registers every meal-menu audit action", () => {
    expect(AUDIT_ACTIONS).toEqual(expect.arrayContaining([...mealMenuActions]));
  });

  it("maps every meal-menu action to ADMIN visibility", () => {
    for (const action of mealMenuActions) {
      expect(ACTION_VISIBILITY[action]).toBe("ADMIN");
    }
  });
});

describe("weekly-plan audit vocab additions", () => {
  const weeklyPlanActions = [
    "CREATE_WEEKLY_PLAN",
    "COPY_WEEKLY_PLAN",
    "UPDATE_WEEKLY_PLAN",
    "ARCHIVE_WEEKLY_PLAN",
    "RESTORE_WEEKLY_PLAN",
  ] as const;

  it("registers every weekly-plan audit action", () => {
    expect(AUDIT_ACTIONS).toEqual(
      expect.arrayContaining([...weeklyPlanActions]),
    );
  });

  it("maps every weekly-plan action to ADMIN visibility", () => {
    for (const action of weeklyPlanActions) {
      expect(ACTION_VISIBILITY[action]).toBe("ADMIN");
    }
  });
});

describe("StaffType audit vocab additions", () => {
  const staffTypeActions = [
    "CREATE_STAFF_TYPE",
    "UPDATE_STAFF_TYPE",
    "ARCHIVE_STAFF_TYPE",
    "REORDER_STAFF_TYPES",
  ] as const;

  it("registers every StaffType audit action", () => {
    expect(AUDIT_ACTIONS).toEqual(
      expect.arrayContaining([...staffTypeActions]),
    );
  });

  it("maps every StaffType action to ADMIN visibility", () => {
    for (const action of staffTypeActions) {
      expect(ACTION_VISIBILITY[action]).toBe("ADMIN");
    }
  });
});

describe("global identity lifecycle audit vocab additions", () => {
  const identityActions = [
    "LOCK_GLOBAL_IDENTITY",
    "UNLOCK_GLOBAL_IDENTITY",
    "DELETE_GLOBAL_IDENTITY",
  ] as const;

  it("registers every global identity lifecycle audit action", () => {
    expect(AUDIT_ACTIONS).toEqual(
      expect.arrayContaining([...identityActions]),
    );
  });

  it("maps every global identity lifecycle action to ADMIN visibility", () => {
    for (const action of identityActions) {
      expect(ACTION_VISIBILITY[action]).toBe("ADMIN");
    }
  });
});

describe("guardian existing identity attach audit vocab addition", () => {
  it("registers the guardian existing identity attach action", () => {
    expect(AUDIT_ACTIONS).toContain("ATTACH_EXISTING_GUARDIAN_IDENTITY");
  });

  it("maps guardian existing identity attach to ADMIN visibility", () => {
    expect(ACTION_VISIBILITY.ATTACH_EXISTING_GUARDIAN_IDENTITY).toBe("ADMIN");
  });
});
