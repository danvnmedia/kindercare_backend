#!/usr/bin/env node
/**
 * Export the audit-action codes as a checked-in JSON artifact for the
 * frontend template registry (AC-11 BE side of @doc/specs/admin-audit-log).
 *
 * The FE template registry (per FR-7) keys its locale-resolvable display
 * strings by action code (e.g. `audit.TRANSFER_STUDENT.display`). Rather
 * than have the FE hand-mirror the union, the BE owns the source of truth
 * (`AUDIT_ACTIONS` tuple in `@/domain/audit/audit-action.enum.ts`) and
 * exports it as JSON. The FE imports the JSON at build time and
 * snapshot-tests its registry against the exported set — any new action
 * added BE-side will surface as a missing-entry test failure FE-side.
 *
 * Usage (CLI):
 *
 *   npm run export:audit-actions
 *
 * The script regenerates `generated/audit-actions.json` at the repo root.
 * Commit the regenerated file alongside any change to `AUDIT_ACTIONS`.
 *
 * Output schema:
 *
 *   {
 *     "version": "1.0.0",
 *     "generatedAt": "<ISO 8601 timestamp>",
 *     "source": "src/domain/audit/audit-action.enum.ts",
 *     "spec": "@doc/specs/admin-audit-log",
 *     "actions": [/* action codes in spec FR-1 order *\/]
 *   }
 *
 * See @doc/references/admin-audit-log-frontend-handoff for the FE import
 * recipe and registry-location decision.
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

import { AUDIT_ACTIONS, AuditAction } from "@/domain/audit";

export interface AuditActionsExport {
  version: string;
  generatedAt: string;
  source: string;
  spec: string;
  actions: AuditAction[];
}

const EXPORT_VERSION = "1.0.0";

/**
 * Build the export payload. Pure function (no I/O) so the spec can assert
 * shape and content deterministically by passing a fixed `now`.
 */
export function buildAuditActionsExport(
  now: Date = new Date(),
): AuditActionsExport {
  return {
    version: EXPORT_VERSION,
    generatedAt: now.toISOString(),
    source: "src/domain/audit/audit-action.enum.ts",
    spec: "@doc/specs/admin-audit-log",
    actions: Array.from(AUDIT_ACTIONS),
  };
}

/**
 * Default output path relative to the repo root.
 *
 * The `generated/` directory is intentionally at the root (not under `src/`)
 * because the FE consumes it as a static artifact, not as TS source.
 */
export const DEFAULT_OUTPUT_PATH = "generated/audit-actions.json";

function main(): void {
  const payload = buildAuditActionsExport();
  const outputPath = join(process.cwd(), DEFAULT_OUTPUT_PATH);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(`Wrote ${payload.actions.length} actions → ${outputPath}`);
}

if (require.main === module) {
  main();
}
