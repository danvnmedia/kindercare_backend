/**
 * Spec for the audit-actions JSON exporter (@task-9cx0ob — AC-11 BE side).
 *
 * Two layers:
 *   1. Pure function shape — `buildAuditActionsExport()` returns the documented
 *      schema, in spec FR-1 order, with all 19 v1 actions.
 *   2. Drift detector — the checked-in `generated/audit-actions.json` must
 *      stay in sync with the `AUDIT_ACTIONS` tuple. If you add a new action
 *      and forget to run `npm run export:audit-actions`, this test fails.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { AUDIT_ACTIONS, AuditAction } from "@/domain/audit";

import {
  buildAuditActionsExport,
  DEFAULT_OUTPUT_PATH,
} from "./export-audit-actions";

describe("buildAuditActionsExport", () => {
  it("returns the documented schema with the current AUDIT_ACTIONS tuple", () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    const result = buildAuditActionsExport(now);

    expect(result).toEqual({
      version: "1.0.0",
      generatedAt: "2026-05-20T12:00:00.000Z",
      source: "src/domain/audit/audit-action.enum.ts",
      spec: "@doc/specs/admin-audit-log",
      actions: Array.from(AUDIT_ACTIONS),
    });
  });

  // Locked count — bump deliberately when adding a new action so the FE
  // template registry change-log stays auditable. v1 shipped 19 (admin-audit-log);
  // class-staff lifecycle (assign/remove/change-role) added 3 in
  // @doc/specs/subject-removal-classstaff-role-refactor; direct role
  // assignment (grant/revoke) added 2 in
  // @doc/specs/direct-role-assignment-via-uow; meal-menu lifecycle added 6 in
  // @doc/specs/meal-menu-backend.
  it("emits exactly 30 actions (24 existing + 6 meal-menu)", () => {
    const result = buildAuditActionsExport();
    expect(result.actions).toHaveLength(30);
  });

  it("preserves spec FR-1 group ordering (enrollment → edit → archive → create → link)", () => {
    const result = buildAuditActionsExport();
    // Spot-check group boundaries — the tuple order in `AUDIT_ACTIONS` is the
    // canonical FR-1 order; FE renderers can rely on it for default sorting.
    expect(result.actions[0]).toBe("ENROLL_STUDENT_TO_CLASS");
    expect(result.actions[4]).toBe("WITHDRAW_FROM_SCHOOL_YEAR");
    expect(result.actions[5]).toBe("EDIT_STUDENT_PROFILE");
    expect(result.actions[8]).toBe("ARCHIVE_STUDENT");
    expect(result.actions[14]).toBe("CREATE_STUDENT");
    expect(result.actions[17]).toBe("LINK_GUARDIAN_TO_STUDENT");
    expect(result.actions[18]).toBe("UNLINK_GUARDIAN_FROM_STUDENT");
  });

  it("every emitted action is a member of the AuditAction union", () => {
    const result = buildAuditActionsExport();
    const allowed = new Set<AuditAction>(AUDIT_ACTIONS);
    for (const action of result.actions) {
      expect(allowed.has(action)).toBe(true);
    }
  });
});

describe("checked-in generated/audit-actions.json", () => {
  const generatedPath = join(process.cwd(), DEFAULT_OUTPUT_PATH);

  it("exists at the documented path", () => {
    expect(existsSync(generatedPath)).toBe(true);
  });

  it("matches the AUDIT_ACTIONS tuple — regenerate via `npm run export:audit-actions` if this fails", () => {
    const raw = readFileSync(generatedPath, "utf8");
    const parsed = JSON.parse(raw) as { actions: AuditAction[] };

    expect(parsed.actions).toEqual(Array.from(AUDIT_ACTIONS));
  });
});
