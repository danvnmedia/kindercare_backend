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
