import { ClassRepository } from "@/application/class-management/ports/class.repository";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { WeeklyPlanRepository } from "@/application/weekly-plan/ports";
import { Class } from "@/domain/class-management/entities/class.entity";
import { WeeklyPlan } from "@/domain/weekly-plan";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { ArchiveWeeklyPlanUseCase } from "./archive-weekly-plan.use-case";
import { CopyWeeklyPlanUseCase } from "./copy-weekly-plan.use-case";
import { CreateWeeklyPlanUseCase } from "./create-weekly-plan.use-case";
import { GetActiveWeeklyPlanUseCase } from "./get-active-weekly-plan.use-case";
import { RestoreWeeklyPlanUseCase } from "./restore-weekly-plan.use-case";
import { UpdateWeeklyPlanUseCase } from "./update-weekly-plan.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const DEFAULT_CLASS_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";

function makeClass(id: string): Class {
  return Class.create(
    {
      campusId: CAMPUS_ID,
      name: `Class ${id.slice(0, 4)}`,
      description: null,
      gradeLevelId: "22222222-2222-4222-a222-222222222222",
      schoolYearId: "33333333-3333-4333-a333-333333333333",
    },
    id,
  );
}

function makeWeeklyPlan(
  id = "99999999-9999-4999-a999-999999999999",
  overrides: Partial<{
    classId: string;
    weekStartDate: Date;
    theme: string | null;
  }> = {},
) {
  const classId = overrides.classId ?? DEFAULT_CLASS_ID;

  return WeeklyPlan.create(
    {
      campusId: CAMPUS_ID,
      classId,
      classroom: {
        id: classId,
        name: `Class ${classId.slice(0, 4)}`,
        gradeLevelId: "22222222-2222-4222-a222-222222222222",
        schoolYearId: "33333333-3333-4333-a333-333333333333",
      },
      weekStartDate:
        overrides.weekStartDate ?? new Date("2026-06-15T00:00:00.000Z"),
      theme: overrides.theme,
      blocks: [
        {
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "10:00",
          activities: [{ title: "Morning Meeting" }],
        },
      ],
    },
    id,
  );
}

describe("Weekly Plan use cases", () => {
  let classRepository: jest.Mocked<ClassRepository>;
  let weeklyPlanRepository: jest.Mocked<WeeklyPlanRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let transactionContext: jest.Mocked<
    Pick<
      TransactionContext,
      | "archiveWeeklyPlan"
      | "createWeeklyPlan"
      | "recordAudit"
      | "restoreWeeklyPlan"
      | "updateWeeklyPlan"
    >
  >;

  beforeEach(() => {
    classRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ClassRepository>;
    weeklyPlanRepository = {
      findActiveByNaturalKey: jest.fn(),
      findByIdInCampus: jest.fn(),
    } as unknown as jest.Mocked<WeeklyPlanRepository>;
    transactionContext = {
      archiveWeeklyPlan: jest.fn(async (plan) => plan),
      createWeeklyPlan: jest.fn(async (plan) => plan),
      recordAudit: jest.fn(
        async (_input: Parameters<TransactionContext["recordAudit"]>[0]) => {
          void _input;
        },
      ),
      restoreWeeklyPlan: jest.fn(async (plan) => plan),
      updateWeeklyPlan: jest.fn(async (plan) => plan),
    };
    unitOfWork = {
      run: jest.fn(async (task) =>
        task(transactionContext as unknown as TransactionContext),
      ),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
  });

  it("creates independent plans for multiple valid classes", async () => {
    const classOneId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
    const classTwoId = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
    classRepository.findById.mockImplementation(async (id) =>
      id === classOneId || id === classTwoId ? makeClass(id) : null,
    );
    weeklyPlanRepository.findActiveByNaturalKey.mockResolvedValue(null);

    const useCase = new CreateWeeklyPlanUseCase(
      weeklyPlanRepository,
      classRepository,
      unitOfWork,
    );

    const result = await useCase.execute({
      campusId: CAMPUS_ID,
      classIds: [classOneId, classTwoId],
      weekStartDate: new Date("2026-06-15T00:00:00.000Z"),
      blocks: [
        {
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "10:00",
          activities: [
            {
              title: "Morning Meeting",
              description: "Greeting and calendar",
            },
          ],
        },
      ],
    });

    expect(result.skipped).toEqual([]);
    expect(result.created).toHaveLength(2);
    expect(result.created.map((plan) => plan.classId)).toEqual([
      classOneId,
      classTwoId,
    ]);
    expect(result.created[0].id).not.toBe(result.created[1].id);
    expect(transactionContext.recordAudit).toHaveBeenCalledTimes(2);
    expect(
      transactionContext.recordAudit.mock.calls.map(
        ([payload]) => payload.action,
      ),
    ).toEqual(["CREATE_WEEKLY_PLAN", "CREATE_WEEKLY_PLAN"]);
    expect(result.created[0].blocks[0].activities[0]).toEqual({
      order: 0,
      title: "Morning Meeting",
      description: "Greeting and calendar",
    });
  });

  it("rejects invalid schedule shape before per-class skipping", async () => {
    classRepository.findById.mockResolvedValue(null);

    const useCase = new CreateWeeklyPlanUseCase(
      weeklyPlanRepository,
      classRepository,
      unitOfWork,
    );

    await expect(
      useCase.execute({
        campusId: CAMPUS_ID,
        classIds: ["aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"],
        weekStartDate: new Date("2026-06-15T00:00:00.000Z"),
        blocks: [
          {
            dayOfWeek: 1,
            startTime: "09:00",
            endTime: "10:00",
            activities: [],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects legacy text-only activities before per-class skipping", async () => {
    classRepository.findById.mockResolvedValue(null);

    const useCase = new CreateWeeklyPlanUseCase(
      weeklyPlanRepository,
      classRepository,
      unitOfWork,
    );

    await expect(
      useCase.execute({
        campusId: CAMPUS_ID,
        classIds: ["aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"],
        weekStartDate: new Date("2026-06-15T00:00:00.000Z"),
        blocks: [
          {
            dayOfWeek: 1,
            startTime: "09:00",
            endTime: "10:00",
            activities: [{ text: "Morning Meeting" } as never],
          },
        ],
      }),
    ).rejects.toThrow("Activity title is required");
    expect(classRepository.findById).not.toHaveBeenCalled();
  });

  it("returns null active plan for a valid class/week with no active plan", async () => {
    const classId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
    classRepository.findById.mockResolvedValue(makeClass(classId));
    weeklyPlanRepository.findActiveByNaturalKey.mockResolvedValue(null);

    const useCase = new GetActiveWeeklyPlanUseCase(
      weeklyPlanRepository,
      classRepository,
    );

    const result = await useCase.execute({
      campusId: CAMPUS_ID,
      classId,
      weekStartDate: new Date("2026-06-15T00:00:00.000Z"),
    });

    expect(result).toEqual({ plan: null });
  });

  it("updates one active plan by replacing and sorting the schedule", async () => {
    const plan = makeWeeklyPlan();
    weeklyPlanRepository.findByIdInCampus.mockResolvedValue(plan);
    weeklyPlanRepository.findActiveByNaturalKey.mockResolvedValue(null);

    const useCase = new UpdateWeeklyPlanUseCase(
      weeklyPlanRepository,
      classRepository,
      unitOfWork,
    );

    const result = await useCase.execute(plan.id, {
      campusId: CAMPUS_ID,
      blocks: [
        {
          dayOfWeek: 3,
          startTime: "10:00",
          endTime: "10:30",
          activities: [
            { title: "Centers", description: null },
            { title: "Cleanup" },
          ],
        },
        {
          dayOfWeek: 1,
          startTime: "08:30",
          endTime: "09:00",
          activities: [{ title: "Arrival", description: "Drop-off" }],
        },
      ],
    });

    expect(result.blocks.map((block) => block.dayOfWeek)).toEqual([1, 3]);
    expect(result.blocks[0].activities[0]).toEqual({
      order: 0,
      title: "Arrival",
      description: "Drop-off",
    });
    expect(result.blocks[1].activities).toEqual([
      { order: 0, title: "Centers", description: null },
      { order: 1, title: "Cleanup", description: null },
    ]);
    expect(transactionContext.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE_WEEKLY_PLAN",
        targetType: "weekly_plan",
        targetId: plan.id,
        campusId: CAMPUS_ID,
        beforeValue: expect.objectContaining({
          activityCount: 1,
          isArchived: false,
        }),
        afterValue: expect.objectContaining({
          activityCount: 3,
          isArchived: false,
        }),
      }),
    );
  });

  it("rejects non-Monday weekStartDate on update", async () => {
    const plan = makeWeeklyPlan();
    weeklyPlanRepository.findByIdInCampus.mockResolvedValue(plan);

    const useCase = new UpdateWeeklyPlanUseCase(
      weeklyPlanRepository,
      classRepository,
      unitOfWork,
    );

    await expect(
      useCase.execute(plan.id, {
        campusId: CAMPUS_ID,
        weekStartDate: new Date("2026-06-16T00:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects archived plan mutation", async () => {
    const plan = makeWeeklyPlan();
    plan.archive();
    weeklyPlanRepository.findByIdInCampus.mockResolvedValue(plan);

    const useCase = new UpdateWeeklyPlanUseCase(
      weeklyPlanRepository,
      classRepository,
      unitOfWork,
    );

    await expect(
      useCase.execute(plan.id, {
        campusId: CAMPUS_ID,
        theme: "New Theme",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("copies source schedule and preserves or overrides destination theme", async () => {
    const source = makeWeeklyPlan("99999999-9999-4999-a999-999999999999", {
      theme: "Community Helpers",
    });
    const destinationClassId = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
    classRepository.findById.mockResolvedValue(makeClass(destinationClassId));
    weeklyPlanRepository.findByIdInCampus.mockResolvedValue(source);
    weeklyPlanRepository.findActiveByNaturalKey.mockResolvedValue(null);

    const useCase = new CopyWeeklyPlanUseCase(
      weeklyPlanRepository,
      classRepository,
      unitOfWork,
    );

    const preserved = await useCase.execute(source.id, {
      campusId: CAMPUS_ID,
      classIds: [destinationClassId],
      weekStartDate: new Date("2026-06-22T00:00:00.000Z"),
    });
    const cleared = await useCase.execute(source.id, {
      campusId: CAMPUS_ID,
      classIds: [destinationClassId],
      weekStartDate: new Date("2026-06-29T00:00:00.000Z"),
      theme: null,
    });
    const overridden = await useCase.execute(source.id, {
      campusId: CAMPUS_ID,
      classIds: [destinationClassId],
      weekStartDate: new Date("2026-07-06T00:00:00.000Z"),
      theme: "Spring Review",
    });

    expect(preserved.copied[0].theme).toBe("Community Helpers");
    expect(cleared.copied[0].theme).toBeNull();
    expect(overridden.copied[0].theme).toBe("Spring Review");
    expect(overridden.copied[0].classId).toBe(destinationClassId);
    expect(overridden.copied[0].blocks[0].activities[0]).toEqual({
      order: 0,
      title: "Morning Meeting",
      description: null,
    });
    expect(
      transactionContext.recordAudit.mock.calls.map(
        ([payload]) => payload.action,
      ),
    ).toEqual(["COPY_WEEKLY_PLAN", "COPY_WEEKLY_PLAN", "COPY_WEEKLY_PLAN"]);
    expect(transactionContext.recordAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "COPY_WEEKLY_PLAN",
        targetType: "weekly_plan",
        context: expect.objectContaining({
          sourceWeeklyPlanId: source.id,
          sourceClassId: source.classId,
        }),
      }),
    );
  });

  it("returns stable copy skipped reasons for missing classes and active conflicts", async () => {
    const source = makeWeeklyPlan();
    const conflictClassId = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
    const missingClassId = "cccccccc-cccc-4ccc-cccc-cccccccccccc";
    const validClassId = "dddddddd-dddd-4ddd-dddd-dddddddddddd";

    weeklyPlanRepository.findByIdInCampus.mockResolvedValue(source);
    classRepository.findById.mockImplementation(async (id) =>
      id === missingClassId ? null : makeClass(id),
    );
    weeklyPlanRepository.findActiveByNaturalKey.mockImplementation(
      async (key) =>
        key.classId === conflictClassId ? makeWeeklyPlan("conflict") : null,
    );

    const useCase = new CopyWeeklyPlanUseCase(
      weeklyPlanRepository,
      classRepository,
      unitOfWork,
    );

    const result = await useCase.execute(source.id, {
      campusId: CAMPUS_ID,
      classIds: [conflictClassId, missingClassId, validClassId],
      weekStartDate: new Date("2026-06-22T00:00:00.000Z"),
    });

    expect(result.copied.map((plan) => plan.classId)).toEqual([validClassId]);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        classId: conflictClassId,
        reason: "ACTIVE_WEEKLY_PLAN_EXISTS",
      }),
      expect.objectContaining({
        classId: missingClassId,
        reason: "CLASS_NOT_FOUND",
      }),
    ]);
  });

  it("rejects archived source plan copy", async () => {
    const source = makeWeeklyPlan();
    source.archive();
    weeklyPlanRepository.findByIdInCampus.mockResolvedValue(source);

    const useCase = new CopyWeeklyPlanUseCase(
      weeklyPlanRepository,
      classRepository,
      unitOfWork,
    );

    await expect(
      useCase.execute(source.id, {
        campusId: CAMPUS_ID,
        classIds: ["bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb"],
        weekStartDate: new Date("2026-06-22T00:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects invalid copy theme before per-class skipping", async () => {
    const source = makeWeeklyPlan();
    weeklyPlanRepository.findByIdInCampus.mockResolvedValue(source);

    const useCase = new CopyWeeklyPlanUseCase(
      weeklyPlanRepository,
      classRepository,
      unitOfWork,
    );

    await expect(
      useCase.execute(source.id, {
        campusId: CAMPUS_ID,
        classIds: ["bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb"],
        weekStartDate: new Date("2026-06-22T00:00:00.000Z"),
        theme: "x".repeat(256),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(classRepository.findById).not.toHaveBeenCalled();
  });

  it("archives a weekly plan without deleting schedule content", async () => {
    const plan = makeWeeklyPlan();
    weeklyPlanRepository.findByIdInCampus.mockResolvedValue(plan);

    const useCase = new ArchiveWeeklyPlanUseCase(
      weeklyPlanRepository,
      unitOfWork,
    );

    const result = await useCase.execute(CAMPUS_ID, plan.id);

    expect(result.isArchived).toBe(true);
    expect(result.blocks[0].activities[0]).toEqual({
      order: 0,
      title: "Morning Meeting",
      description: null,
    });
    expect(transactionContext.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ARCHIVE_WEEKLY_PLAN",
        targetType: "weekly_plan",
        targetId: plan.id,
        campusId: CAMPUS_ID,
        beforeValue: expect.objectContaining({ isArchived: false }),
        afterValue: expect.objectContaining({ isArchived: true }),
      }),
    );
  });

  it("restores an archived weekly plan and audits the mutation", async () => {
    const plan = makeWeeklyPlan();
    plan.archive();
    weeklyPlanRepository.findByIdInCampus.mockResolvedValue(plan);
    weeklyPlanRepository.findActiveByNaturalKey.mockResolvedValue(null);

    const useCase = new RestoreWeeklyPlanUseCase(
      weeklyPlanRepository,
      unitOfWork,
    );

    const result = await useCase.execute(CAMPUS_ID, plan.id);

    expect(result.isArchived).toBe(false);
    expect(transactionContext.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "RESTORE_WEEKLY_PLAN",
        targetType: "weekly_plan",
        targetId: plan.id,
        campusId: CAMPUS_ID,
        beforeValue: expect.objectContaining({ isArchived: true }),
        afterValue: expect.objectContaining({ isArchived: false }),
      }),
    );
  });

  it("blocks restore when another active plan has the same natural key", async () => {
    const plan = makeWeeklyPlan();
    plan.archive();
    weeklyPlanRepository.findByIdInCampus.mockResolvedValue(plan);
    weeklyPlanRepository.findActiveByNaturalKey.mockResolvedValue(
      makeWeeklyPlan("88888888-8888-4888-a888-888888888888"),
    );

    const useCase = new RestoreWeeklyPlanUseCase(
      weeklyPlanRepository,
      unitOfWork,
    );

    await expect(useCase.execute(CAMPUS_ID, plan.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(plan.isArchived).toBe(true);
  });

  it("maps concurrent duplicate copy and restore attempts to conflicts", async () => {
    const source = makeWeeklyPlan();
    const archived = makeWeeklyPlan("77777777-7777-4777-a777-777777777777");
    archived.archive();
    const uniqueError = { code: "P2002" };

    classRepository.findById.mockResolvedValue(
      makeClass("bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb"),
    );
    weeklyPlanRepository.findByIdInCampus
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(archived);
    weeklyPlanRepository.findActiveByNaturalKey.mockResolvedValue(null);
    unitOfWork.run
      .mockRejectedValueOnce(uniqueError)
      .mockRejectedValueOnce(uniqueError);

    const copyUseCase = new CopyWeeklyPlanUseCase(
      weeklyPlanRepository,
      classRepository,
      unitOfWork,
    );
    const restoreUseCase = new RestoreWeeklyPlanUseCase(
      weeklyPlanRepository,
      unitOfWork,
    );

    const copyResult = await copyUseCase.execute(source.id, {
      campusId: CAMPUS_ID,
      classIds: ["bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb"],
      weekStartDate: new Date("2026-06-22T00:00:00.000Z"),
    });

    expect(copyResult).toEqual({
      copied: [],
      skipped: [
        expect.objectContaining({ reason: "ACTIVE_WEEKLY_PLAN_EXISTS" }),
      ],
    });
    await expect(
      restoreUseCase.execute(CAMPUS_ID, archived.id),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("propagates audit failures from the weekly-plan transaction", async () => {
    const plan = makeWeeklyPlan();
    const auditError = new Error("audit failed");
    weeklyPlanRepository.findByIdInCampus.mockResolvedValue(plan);
    weeklyPlanRepository.findActiveByNaturalKey.mockResolvedValue(null);
    transactionContext.recordAudit.mockRejectedValue(auditError);

    const useCase = new UpdateWeeklyPlanUseCase(
      weeklyPlanRepository,
      classRepository,
      unitOfWork,
    );

    await expect(
      useCase.execute(plan.id, {
        campusId: CAMPUS_ID,
        theme: "Audit Failure",
      }),
    ).rejects.toBe(auditError);
    expect(transactionContext.updateWeeklyPlan).toHaveBeenCalledTimes(1);
    expect(transactionContext.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_WEEKLY_PLAN" }),
    );
  });
});
