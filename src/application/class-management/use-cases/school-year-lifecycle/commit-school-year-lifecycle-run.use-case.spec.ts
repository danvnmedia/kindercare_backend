import { createUser } from "@/test-utils/entity-factories";

import { CommitSchoolYearLifecycleRunUseCase } from "./commit-school-year-lifecycle-run.use-case";
import { GetSchoolYearLifecycleResultsUseCase } from "./get-school-year-lifecycle-results.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const RUN_ID = "22222222-2222-4222-a222-222222222222";
const PREVIEW_ID = "33333333-3333-4333-a333-333333333333";
const CANDIDATE_ID = "44444444-4444-4444-a444-444444444444";
const STUDENT_ID = "55555555-5555-4555-a555-555555555555";
const ACTOR_ID = "66666666-6666-4666-a666-666666666666";
const PREPARER_ID = "77777777-7777-4777-a777-777777777777";
const DIGEST = "a".repeat(64);

const preview = {
  id: PREVIEW_ID,
  lifecycleRunId: RUN_ID,
  runVersion: 7,
  campusId: CAMPUS_ID,
  digest: DIGEST,
  status: "VALID",
  expiresAt: new Date("2026-07-11T12:00:00.000Z"),
  createdByUserId: PREPARER_ID,
} as any;
const commitResult = {
  previewRunId: PREVIEW_ID,
  digest: DIGEST,
  campusId: CAMPUS_ID,
  sourceSchoolYearId: "source-year",
  targetSchoolYearId: "target-year",
  sourceClosureDate: new Date(),
  targetEnrollmentDate: new Date(),
  rows: [
    {
      studentId: STUDENT_ID,
      outcome: "PROMOTE",
      targetClassId: "target-class",
      status: "SUCCESS",
      operations: [],
      context: {
        targetSchoolYearEnrollmentId: "target-sye",
        targetClassEnrollmentId: "target-enrollment",
      },
    },
  ],
} as any;

describe("CommitSchoolYearLifecycleRunUseCase", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-10T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("lets a distinct authorized actor commit the preparer's exact preview membership", async () => {
    const lifecycleRepository = {
      findPreviewRunById: jest.fn().mockResolvedValue(preview),
      findPreviewMemberships: jest.fn().mockResolvedValue([
        {
          candidateId: CANDIDATE_ID,
          studentId: STUDENT_ID,
          sequence: 0,
          normalizedRow: {},
        },
      ]),
      startCommitAttempt: jest.fn().mockResolvedValue("attempt-1"),
      finalizeCommitAttempt: jest.fn().mockResolvedValue({
        attempt: { id: "attempt-1" },
        run: { status: "COMPLETED", version: 8 },
      }),
      failCommitAttempt: jest.fn(),
    } as any;
    const commitUseCase = {
      execute: jest.fn().mockResolvedValue(commitResult),
    };
    const useCase = new CommitSchoolYearLifecycleRunUseCase(
      lifecycleRepository,
      commitUseCase as any,
    );

    const result = await useCase.execute(
      {
        lifecycleRunId: RUN_ID,
        campusId: CAMPUS_ID,
        previewRunId: PREVIEW_ID,
        digest: DIGEST,
      },
      createUser({ id: ACTOR_ID }),
    );

    expect(lifecycleRepository.startCommitAttempt).toHaveBeenCalledWith({
      lifecycleRunId: RUN_ID,
      previewRunId: PREVIEW_ID,
      runVersion: 7,
      campusId: CAMPUS_ID,
      createdByUserId: ACTOR_ID,
    });
    expect(ACTOR_ID).not.toBe(preview.createdByUserId);
    expect(commitUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        previewRunId: PREVIEW_ID,
        digest: DIGEST,
        allowRunScoped: true,
      }),
      expect.anything(),
    );
    expect(lifecycleRepository.finalizeCommitAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        commitAttemptId: "attempt-1",
        rows: [
          expect.objectContaining({
            candidateId: CANDIDATE_ID,
            result: commitResult.rows[0],
          }),
        ],
      }),
    );
    expect(lifecycleRepository.failCommitAttempt).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      lifecycleRunId: RUN_ID,
      commitAttemptId: "attempt-1",
      runStatus: "COMPLETED",
      runVersion: 8,
    });
  });

  it("rejects an expired preview before acquiring a commit lock", async () => {
    const lifecycleRepository = {
      findPreviewRunById: jest.fn().mockResolvedValue({
        ...preview,
        expiresAt: new Date("2026-07-10T11:59:59.000Z"),
      }),
      startCommitAttempt: jest.fn(),
    } as any;
    const commitUseCase = { execute: jest.fn() };
    const useCase = new CommitSchoolYearLifecycleRunUseCase(
      lifecycleRepository,
      commitUseCase as any,
    );

    await expect(
      useCase.execute(
        {
          lifecycleRunId: RUN_ID,
          campusId: CAMPUS_ID,
          previewRunId: PREVIEW_ID,
          digest: DIGEST,
        },
        createUser({ id: ACTOR_ID }),
      ),
    ).rejects.toThrow("PREVIEW_EXPIRED");
    expect(lifecycleRepository.startCommitAttempt).not.toHaveBeenCalled();
  });

  it("rejects commit when a source cancellation prevents lock acquisition", async () => {
    const lifecycleRepository = {
      findPreviewRunById: jest.fn().mockResolvedValue(preview),
      findPreviewMemberships: jest.fn().mockResolvedValue([
        {
          candidateId: CANDIDATE_ID,
          studentId: STUDENT_ID,
          sequence: 0,
        },
      ]),
      startCommitAttempt: jest.fn().mockResolvedValue(null),
    } as any;
    const useCase = new CommitSchoolYearLifecycleRunUseCase(
      lifecycleRepository,
      { execute: jest.fn() } as any,
    );

    await expect(
      useCase.execute(
        {
          lifecycleRunId: RUN_ID,
          campusId: CAMPUS_ID,
          previewRunId: PREVIEW_ID,
          digest: DIGEST,
        },
        createUser({ id: ACTOR_ID }),
      ),
    ).rejects.toThrow("SOURCE_REGISTRATION_CANCELLED");
  });

  it.each([
    ["INVALIDATED", "PREVIEW_INVALIDATED"],
    ["SUPERSEDED", "PREVIEW_SUPERSEDED"],
    ["FINALIZED", "PREVIEW_FINALIZED"],
  ])("rejects a %s preview with %s", async (status, code) => {
    const lifecycleRepository = {
      findPreviewRunById: jest.fn().mockResolvedValue({ ...preview, status }),
      startCommitAttempt: jest.fn(),
    } as any;
    const useCase = new CommitSchoolYearLifecycleRunUseCase(
      lifecycleRepository,
      { execute: jest.fn() } as any,
    );

    await expect(
      useCase.execute(
        {
          lifecycleRunId: RUN_ID,
          campusId: CAMPUS_ID,
          previewRunId: PREVIEW_ID,
          digest: DIGEST,
        },
        createUser({ id: ACTOR_ID }),
      ),
    ).rejects.toThrow(code);
    expect(lifecycleRepository.startCommitAttempt).not.toHaveBeenCalled();
  });

  it("releases the preview lock when commit orchestration throws", async () => {
    const lifecycleRepository = {
      findPreviewRunById: jest.fn().mockResolvedValue(preview),
      findPreviewMemberships: jest.fn().mockResolvedValue([
        {
          candidateId: CANDIDATE_ID,
          studentId: STUDENT_ID,
          sequence: 0,
        },
      ]),
      startCommitAttempt: jest.fn().mockResolvedValue("attempt-1"),
      failCommitAttempt: jest.fn().mockResolvedValue(undefined),
    } as any;
    const commitUseCase = {
      execute: jest.fn().mockRejectedValue(new Error("database unavailable")),
    };
    const useCase = new CommitSchoolYearLifecycleRunUseCase(
      lifecycleRepository,
      commitUseCase as any,
    );

    await expect(
      useCase.execute(
        {
          lifecycleRunId: RUN_ID,
          campusId: CAMPUS_ID,
          previewRunId: PREVIEW_ID,
          digest: DIGEST,
        },
        createUser({ id: ACTOR_ID }),
      ),
    ).rejects.toThrow("database unavailable");
    expect(lifecycleRepository.failCommitAttempt).toHaveBeenCalledWith(
      "attempt-1",
      PREVIEW_ID,
      CAMPUS_ID,
      undefined,
    );
  });
});

describe("GetSchoolYearLifecycleResultsUseCase", () => {
  it("reloads persisted attempts in a later request", async () => {
    const attempts = [{ id: "attempt-1", rows: [{ id: "row-1" }] }];
    const repository = {
      findRunById: jest.fn().mockResolvedValue({ id: RUN_ID }),
      findCommitAttempts: jest.fn().mockResolvedValue(attempts),
    } as any;
    const useCase = new GetSchoolYearLifecycleResultsUseCase(repository);

    await expect(useCase.execute(RUN_ID, CAMPUS_ID, 20)).resolves.toBe(
      attempts,
    );
    expect(repository.findCommitAttempts).toHaveBeenCalledWith(
      RUN_ID,
      CAMPUS_ID,
      20,
    );
  });
});
