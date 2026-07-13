import { PERMISSIONS_KEY } from "../../decorators/permissions.decorator";
import { DECORATORS } from "@nestjs/swagger";
import { SchoolYearLifecycleController } from "./school-year-lifecycle.controller";

describe("SchoolYearLifecycleController permissions", () => {
  const permissionsFor = (method: keyof SchoolYearLifecycleController) =>
    Reflect.getMetadata(
      PERMISSIONS_KEY,
      SchoolYearLifecycleController.prototype[method],
    );

  it("guards preview and commit with explicit lifecycle permissions", () => {
    expect(permissionsFor("preview")).toEqual([
      "school_year_lifecycle.preview",
    ]);
    expect(permissionsFor("commit")).toEqual(["school_year_lifecycle.commit"]);
  });

  it("guards run reads and setup mutations with distinct permissions", () => {
    expect(permissionsFor("getRun")).toEqual(["school_year_lifecycle.read"]);
    expect(permissionsFor("createOrResumeRun")).toEqual([
      "school_year_lifecycle.manage",
    ]);
    expect(permissionsFor("updateRunSetup")).toEqual([
      "school_year_lifecycle.manage",
    ]);
    expect(permissionsFor("cancelRun")).toEqual([
      "school_year_lifecycle.manage",
    ]);
    expect(permissionsFor("getCandidates")).toEqual([
      "school_year_lifecycle.read",
    ]);
    expect(permissionsFor("getProgress")).toEqual([
      "school_year_lifecycle.read",
    ]);
    expect(permissionsFor("refreshCandidates")).toEqual([
      "school_year_lifecycle.manage",
    ]);
    expect(permissionsFor("saveDecisions")).toEqual([
      "school_year_lifecycle.manage",
    ]);
    expect(permissionsFor("bulkSaveDecisions")).toEqual([
      "school_year_lifecycle.manage",
    ]);
    expect(permissionsFor("previewRun")).toEqual([
      "school_year_lifecycle.preview",
    ]);
    expect(permissionsFor("commitRun")).toEqual([
      "school_year_lifecycle.commit",
    ]);
    expect(permissionsFor("getResults")).toEqual([
      "school_year_lifecycle.read",
    ]);
  });

  it("documents the legacy preview/commit migration path as deprecated", () => {
    const operationFor = (method: "preview" | "commit") =>
      Reflect.getMetadata(
        DECORATORS.API_OPERATION,
        SchoolYearLifecycleController.prototype[method],
      );

    expect(operationFor("preview")).toMatchObject({
      deprecated: true,
      description: expect.stringContaining("runs/{lifecycleRunId}/preview"),
    });
    expect(operationFor("commit")).toMatchObject({
      deprecated: true,
      description: expect.stringContaining("runs/{lifecycleRunId}/commit"),
    });
  });
});
