/**
 * Spec for the audit-actions JSON exporter (@task-9cx0ob — AC-11 BE side).
 *
 * Two layers:
 *   1. Pure function shape — `buildAuditActionsExport()` returns the documented
 *      schema, in spec FR-1 order, with all current actions.
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
  // template registry change-log stays auditable. v1 shipped 19
  // (admin-audit-log); guardian/student links added 2; class-staff lifecycle
  // added 3; direct role assignment added 2; role lifecycle added 3; global
  // identity lifecycle added 3; staff-type lifecycle added 4; meal-menu
  // lifecycle added 6; weekly-plan lifecycle added 5; student-health profile
  // updates added 1; student-health checkup lifecycle added 3; student-health
  // instruction lifecycle added 3; student-health event lifecycle added 3;
  // medication request lifecycle added 1; school-year grade correction added 1;
  // school-year lifecycle run/decision/preview/commit added 9;
  // historical record correction/export/retention lifecycle added 6; future
  // school-year enrollment cancellation added 1; CMS lifecycle added 15.
  it("emits exactly 90 actions including health archival and CMS lifecycle", () => {
    const result = buildAuditActionsExport();
    expect(result.actions).toHaveLength(90);
  });

  it("preserves spec FR-1 group ordering (enrollment → edit → archive → create → link)", () => {
    const result = buildAuditActionsExport();
    // Spot-check group boundaries — the tuple order in `AUDIT_ACTIONS` is the
    // canonical FR-1 order; FE renderers can rely on it for default sorting.
    expect(result.actions[0]).toBe("ENROLL_STUDENT_TO_CLASS");
    expect(result.actions[4]).toBe("WITHDRAW_FROM_SCHOOL_YEAR");
    expect(result.actions[5]).toBe("CANCEL_SCHOOL_YEAR_ENROLLMENT");
    expect(result.actions[6]).toBe("CORRECT_SCHOOL_YEAR_ENROLLMENT_GRADE");
    expect(result.actions.slice(7, 16)).toEqual([
      "CREATE_SCHOOL_YEAR_LIFECYCLE_RUN",
      "UPDATE_SCHOOL_YEAR_LIFECYCLE_SETUP",
      "CANCEL_SCHOOL_YEAR_LIFECYCLE_RUN",
      "EXPIRE_SCHOOL_YEAR_LIFECYCLE_RUN",
      "REFRESH_SCHOOL_YEAR_LIFECYCLE_CANDIDATES",
      "SAVE_SCHOOL_YEAR_LIFECYCLE_DECISIONS",
      "PREVIEW_SCHOOL_YEAR_LIFECYCLE",
      "COMMIT_SCHOOL_YEAR_LIFECYCLE",
      "COMMIT_SCHOOL_YEAR_LIFECYCLE_ROW",
    ]);
    expect(result.actions.slice(16, 22)).toEqual([
      "CORRECT_HISTORICAL_RECORD",
      "EXPORT_HISTORICAL_RECORD",
      "ARCHIVE_HISTORICAL_RECORD",
      "REDACT_HISTORICAL_RECORD",
      "DELETE_HISTORICAL_RECORD",
      "BLOCK_STUDENT_HARD_DELETE_FOR_RETENTION",
    ]);
    expect(result.actions.indexOf("EDIT_STUDENT_PROFILE")).toBeLessThan(
      result.actions.indexOf("ARCHIVE_STUDENT"),
    );
    expect(result.actions.indexOf("ARCHIVE_STUDENT")).toBeLessThan(
      result.actions.indexOf("CREATE_STUDENT"),
    );
    expect(result.actions.indexOf("CREATE_STUDENT")).toBeLessThan(
      result.actions.indexOf("LINK_GUARDIAN_TO_STUDENT"),
    );
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
