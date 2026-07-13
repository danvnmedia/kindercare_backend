import { PERMISSIONS_KEY } from "../../decorators/permissions.decorator";
import { HistoricalRecordController } from "./historical-record.controller";

describe("HistoricalRecordController permissions", () => {
  const permissionsFor = (method: keyof HistoricalRecordController) =>
    Reflect.getMetadata(
      PERMISSIONS_KEY,
      HistoricalRecordController.prototype[method],
    );

  it("guards correction and retention mutation routes with explicit historical permissions", () => {
    expect(permissionsFor("correct")).toEqual(["historical_records.correct"]);
    expect(permissionsFor("archive")).toEqual(["historical_records.archive"]);
    expect(permissionsFor("redact")).toEqual(["historical_records.redact"]);
    expect(permissionsFor("delete")).toEqual(["historical_records.delete"]);
  });

  it("leaves export unguarded by PermissionsGuard so the use case can audit denied attempts", () => {
    expect(permissionsFor("export")).toBeUndefined();
  });
});
