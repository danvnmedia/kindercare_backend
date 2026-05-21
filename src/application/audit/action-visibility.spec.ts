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
