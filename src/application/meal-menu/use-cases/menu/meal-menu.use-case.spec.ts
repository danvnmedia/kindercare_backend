import { GradeLevelRepository } from "@/application/class-management/ports/grade-level.repository";
import {
  MealMenuConfigRepository,
  MealMenuRepository,
} from "@/application/meal-menu/ports";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import {
  createGradeLevel,
  createMealMenu,
  createMealMenuConfig,
  createMockGradeLevelRepository,
  createMockMealMenuConfigRepository,
  createMockMealMenuRepository,
  DEFAULT_CAMPUS_ID_A,
  DEFAULT_CAMPUS_ID_B,
} from "@/test-utils";

import { ArchiveMealMenuUseCase } from "./archive-meal-menu.use-case";
import { CopyMealMenuUseCase } from "./copy-meal-menu.use-case";
import { CreateMealMenuUseCase } from "./create-meal-menu.use-case";
import { GetMealMenuByIdUseCase } from "./get-meal-menu-by-id.use-case";
import { GetMealMenusUseCase } from "./get-meal-menus.use-case";
import { RestoreMealMenuUseCase } from "./restore-meal-menu.use-case";
import { UpdateMealMenuUseCase } from "./update-meal-menu.use-case";

const MONDAY = new Date("2026-06-01T00:00:00.000Z");
const NEXT_MONDAY = new Date("2026-06-08T00:00:00.000Z");
const GRADE_LEVEL_ID = "55555555-5555-4555-a555-555555555555";
const DUPLICATE_MEAL_MENU_MESSAGE =
  "An active meal menu already exists for this campus, target, and week";
const GRADE_LEVEL_NOT_FOUND_MESSAGE = `Grade level with ID ${GRADE_LEVEL_ID} not found`;
const PAGINATION = {
  count: 1,
  limit: 10,
  offset: 0,
  totalPages: 1,
  currentPage: 1,
  hasNext: false,
  hasPrev: false,
};

describe("MealMenu use cases", () => {
  let mealMenuRepository: jest.Mocked<MealMenuRepository>;
  let mealMenuConfigRepository: jest.Mocked<MealMenuConfigRepository>;
  let gradeLevelRepository: jest.Mocked<GradeLevelRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let transactionContext: jest.Mocked<
    Pick<
      TransactionContext,
      | "archiveMealMenu"
      | "createMealMenu"
      | "recordAudit"
      | "restoreMealMenu"
      | "updateMealMenu"
    >
  >;
  let archiveUseCase: ArchiveMealMenuUseCase;
  let copyUseCase: CopyMealMenuUseCase;
  let createUseCase: CreateMealMenuUseCase;
  let getListUseCase: GetMealMenusUseCase;
  let getByIdUseCase: GetMealMenuByIdUseCase;
  let restoreUseCase: RestoreMealMenuUseCase;
  let updateUseCase: UpdateMealMenuUseCase;

  beforeEach(() => {
    mealMenuRepository = createMockMealMenuRepository();
    mealMenuConfigRepository = createMockMealMenuConfigRepository();
    gradeLevelRepository = createMockGradeLevelRepository();

    mealMenuRepository.findActiveByNaturalKey.mockResolvedValue(null);
    mealMenuRepository.findByCampusId.mockResolvedValue({
      data: [],
      pagination: PAGINATION,
    });
    mealMenuRepository.save.mockImplementation(async (menu) => menu);
    mealMenuRepository.update.mockImplementation(async (menu) => menu);
    mealMenuRepository.archive.mockImplementation(async (menu) => menu);
    mealMenuRepository.restore.mockImplementation(async (menu) => menu);
    mealMenuConfigRepository.findByCampusId.mockResolvedValue(null);

    transactionContext = {
      archiveMealMenu: jest.fn((menu) => mealMenuRepository.archive(menu)),
      createMealMenu: jest.fn((menu) => mealMenuRepository.save(menu)),
      recordAudit: jest.fn(),
      restoreMealMenu: jest.fn((menu) => mealMenuRepository.restore(menu)),
      updateMealMenu: jest.fn((menu) => mealMenuRepository.update(menu)),
    } as jest.Mocked<
      Pick<
        TransactionContext,
        | "archiveMealMenu"
        | "createMealMenu"
        | "recordAudit"
        | "restoreMealMenu"
        | "updateMealMenu"
      >
    >;
    unitOfWork = {
      run: jest.fn((task) =>
        task(transactionContext as unknown as TransactionContext),
      ),
    } as unknown as jest.Mocked<UnitOfWorkPort>;

    archiveUseCase = new ArchiveMealMenuUseCase(mealMenuRepository, unitOfWork);
    copyUseCase = new CopyMealMenuUseCase(
      mealMenuRepository,
      gradeLevelRepository,
      unitOfWork,
    );
    createUseCase = new CreateMealMenuUseCase(
      mealMenuRepository,
      mealMenuConfigRepository,
      gradeLevelRepository,
      unitOfWork,
    );
    getListUseCase = new GetMealMenusUseCase(
      mealMenuRepository,
      gradeLevelRepository,
    );
    getByIdUseCase = new GetMealMenuByIdUseCase(mealMenuRepository);
    restoreUseCase = new RestoreMealMenuUseCase(mealMenuRepository, unitOfWork);
    updateUseCase = new UpdateMealMenuUseCase(
      mealMenuRepository,
      gradeLevelRepository,
      unitOfWork,
    );
  });

  describe("CreateMealMenuUseCase", () => {
    it("creates a whole-campus menu with virtual defaults when days and mealSlots are omitted", async () => {
      const result = await createUseCase.execute({
        campusId: DEFAULT_CAMPUS_ID_A,
        weekStartDate: MONDAY,
        gradeLevelId: null,
      });

      expect(result.campusId).toBe(DEFAULT_CAMPUS_ID_A);
      expect(result.gradeLevelId).toBeNull();
      expect(result.days).toEqual([1, 2, 3, 4, 5]);
      expect(result.mealSlots).toEqual(["Breakfast", "Lunch", "Afternoon"]);
      expect(mealMenuConfigRepository.findByCampusId).toHaveBeenCalledWith(
        DEFAULT_CAMPUS_ID_A,
      );
      expect(mealMenuConfigRepository.save).not.toHaveBeenCalled();
      expect(mealMenuConfigRepository.upsert).not.toHaveBeenCalled();
      expect(mealMenuRepository.findActiveByNaturalKey).toHaveBeenCalledWith({
        campusId: DEFAULT_CAMPUS_ID_A,
        gradeLevelId: null,
        weekStartDate: MONDAY,
      });
      expect(mealMenuRepository.save).toHaveBeenCalledTimes(1);
      expect(unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(transactionContext.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CREATE_MEAL_MENU",
          campusId: DEFAULT_CAMPUS_ID_A,
          targetId: result.id,
          targetType: "meal_menu",
        }),
      );
    });

    it("propagates audit failures after the create write inside the UoW closure", async () => {
      const auditError = new Error("audit failed");
      transactionContext.recordAudit.mockRejectedValueOnce(auditError);

      await expect(
        createUseCase.execute({
          campusId: DEFAULT_CAMPUS_ID_A,
          weekStartDate: MONDAY,
          gradeLevelId: null,
        }),
      ).rejects.toThrow(auditError);

      expect(unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(mealMenuRepository.save).toHaveBeenCalledTimes(1);
      expect(transactionContext.recordAudit).toHaveBeenCalledTimes(1);
    });

    it("snapshots saved config defaults when create omits days and mealSlots", async () => {
      mealMenuConfigRepository.findByCampusId.mockResolvedValue(
        createMealMenuConfig({
          operatingDays: [2, 3, 4, 5, 6],
          defaultMealSlots: ["Morning Snack", "Lunch"],
        }),
      );

      const result = await createUseCase.execute({
        campusId: DEFAULT_CAMPUS_ID_A,
        weekStartDate: MONDAY,
        entries: [
          { dayOfWeek: 2, slot: " Morning Snack ", description: " Fruit " },
        ],
      });

      expect(result.days).toEqual([2, 3, 4, 5, 6]);
      expect(result.mealSlots).toEqual(["Morning Snack", "Lunch"]);
      expect(result.entries).toEqual([
        { dayOfWeek: 2, slot: "Morning Snack", description: "Fruit" },
      ]);
    });

    it("creates a grade-level menu when the grade belongs to the active campus", async () => {
      gradeLevelRepository.findById.mockResolvedValue(
        createGradeLevel({
          id: GRADE_LEVEL_ID,
          campusId: DEFAULT_CAMPUS_ID_A,
          name: "Kindergarten",
        }),
      );

      const result = await createUseCase.execute({
        campusId: DEFAULT_CAMPUS_ID_A,
        gradeLevelId: GRADE_LEVEL_ID,
        weekStartDate: MONDAY,
        days: [1, 2],
        mealSlots: ["Breakfast"],
      });

      expect(result.gradeLevelId).toBe(GRADE_LEVEL_ID);
      expect(result.gradeLevel).toEqual({
        id: GRADE_LEVEL_ID,
        name: "Kindergarten",
      });
      expect(gradeLevelRepository.findById).toHaveBeenCalledWith(
        GRADE_LEVEL_ID,
      );
    });

    it("rejects missing or cross-campus grade-level targets", async () => {
      gradeLevelRepository.findById.mockResolvedValueOnce(null);

      await expect(
        createUseCase.execute({
          campusId: DEFAULT_CAMPUS_ID_A,
          gradeLevelId: GRADE_LEVEL_ID,
          weekStartDate: MONDAY,
        }),
      ).rejects.toThrow(GRADE_LEVEL_NOT_FOUND_MESSAGE);

      gradeLevelRepository.findById.mockResolvedValueOnce(
        createGradeLevel({
          id: GRADE_LEVEL_ID,
          campusId: DEFAULT_CAMPUS_ID_B,
        }),
      );

      await expect(
        createUseCase.execute({
          campusId: DEFAULT_CAMPUS_ID_A,
          gradeLevelId: GRADE_LEVEL_ID,
          weekStartDate: MONDAY,
        }),
      ).rejects.toThrow(GRADE_LEVEL_NOT_FOUND_MESSAGE);

      expect(mealMenuRepository.save).not.toHaveBeenCalled();
    });

    it("rejects non-Monday dates and invalid grid values before persistence", async () => {
      await expect(
        createUseCase.execute({
          campusId: DEFAULT_CAMPUS_ID_A,
          weekStartDate: new Date("2026-06-02T00:00:00.000Z"),
        }),
      ).rejects.toThrow("weekStartDate must be a Monday");

      await expect(
        createUseCase.execute({
          campusId: DEFAULT_CAMPUS_ID_A,
          weekStartDate: MONDAY,
          days: [1],
          mealSlots: ["Breakfast"],
          entries: [{ dayOfWeek: 2, slot: "Breakfast", description: "Toast" }],
        }),
      ).rejects.toThrow("Entry dayOfWeek must exist in menu days");

      await expect(
        createUseCase.execute({
          campusId: DEFAULT_CAMPUS_ID_A,
          weekStartDate: MONDAY,
          mealSlots: ["Breakfast", " Breakfast "],
        }),
      ).rejects.toThrow("mealSlots must not contain duplicate labels");

      await expect(
        createUseCase.execute({
          campusId: DEFAULT_CAMPUS_ID_A,
          weekStartDate: MONDAY,
          entries: [
            { dayOfWeek: 1, slot: "Breakfast", description: "Toast" },
            { dayOfWeek: 1, slot: " Breakfast ", description: "Fruit" },
          ],
        }),
      ).rejects.toThrow("Duplicate meal-menu entry cell");

      expect(mealMenuRepository.save).not.toHaveBeenCalled();
    });

    it("trims descriptions and omits blank entries", async () => {
      const result = await createUseCase.execute({
        campusId: DEFAULT_CAMPUS_ID_A,
        weekStartDate: MONDAY,
        entries: [
          { dayOfWeek: 1, slot: "Breakfast", description: " Oatmeal " },
          { dayOfWeek: 2, slot: "Lunch", description: "   " },
        ],
      });

      expect(result.entries).toEqual([
        { dayOfWeek: 1, slot: "Breakfast", description: "Oatmeal" },
      ]);
    });

    it("returns a conflict for duplicate active menus", async () => {
      mealMenuRepository.findActiveByNaturalKey.mockResolvedValue(
        createMealMenu(),
      );

      await expect(
        createUseCase.execute({
          campusId: DEFAULT_CAMPUS_ID_A,
          weekStartDate: MONDAY,
        }),
      ).rejects.toThrow(DUPLICATE_MEAL_MENU_MESSAGE);

      expect(mealMenuRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("CopyMealMenuUseCase", () => {
    it("copies an active source menu to a whole-campus destination", async () => {
      const source = createMealMenu({
        title: "Source Menu",
        days: [1, 3],
        mealSlots: ["Breakfast", "Lunch"],
        entries: [
          { dayOfWeek: 1, slot: "Breakfast", description: "Oatmeal" },
          { dayOfWeek: 3, slot: "Lunch", description: "Pasta" },
        ],
      });
      mealMenuRepository.findByIdInCampus.mockResolvedValue(source);

      const result = await copyUseCase.execute(source.id, {
        campusId: DEFAULT_CAMPUS_ID_A,
        weekStartDate: NEXT_MONDAY,
        gradeLevelId: null,
      });

      expect(result.campusId).toBe(DEFAULT_CAMPUS_ID_A);
      expect(result.gradeLevelId).toBeNull();
      expect(result.weekStartDate).toEqual(NEXT_MONDAY);
      expect(result.title).toBe("Source Menu");
      expect(result.days).toEqual(source.days);
      expect(result.mealSlots).toEqual(source.mealSlots);
      expect(result.entries).toEqual(source.entries);
      expect(mealMenuRepository.findByIdInCampus).toHaveBeenCalledWith(
        DEFAULT_CAMPUS_ID_A,
        source.id,
      );
      expect(mealMenuRepository.findActiveByNaturalKey).toHaveBeenCalledWith({
        campusId: DEFAULT_CAMPUS_ID_A,
        gradeLevelId: null,
        weekStartDate: NEXT_MONDAY,
      });
      expect(mealMenuRepository.save).toHaveBeenCalledTimes(1);
      expect(unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(transactionContext.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "COPY_MEAL_MENU",
          campusId: DEFAULT_CAMPUS_ID_A,
          targetId: result.id,
          targetType: "meal_menu",
        }),
      );
    });

    it("copies to a grade-level destination when the grade belongs to the active campus", async () => {
      const source = createMealMenu({ title: "Source Menu" });
      mealMenuRepository.findByIdInCampus.mockResolvedValue(source);
      gradeLevelRepository.findById.mockResolvedValue(
        createGradeLevel({
          id: GRADE_LEVEL_ID,
          campusId: DEFAULT_CAMPUS_ID_A,
          name: "Kindergarten",
        }),
      );

      const result = await copyUseCase.execute(source.id, {
        campusId: DEFAULT_CAMPUS_ID_A,
        weekStartDate: NEXT_MONDAY,
        gradeLevelId: GRADE_LEVEL_ID,
        title: "Copied Menu",
      });

      expect(result.gradeLevelId).toBe(GRADE_LEVEL_ID);
      expect(result.gradeLevel).toEqual({
        id: GRADE_LEVEL_ID,
        name: "Kindergarten",
      });
      expect(result.title).toBe("Copied Menu");
      expect(result.days).toEqual(source.days);
      expect(result.mealSlots).toEqual(source.mealSlots);
      expect(result.entries).toEqual(source.entries);
      expect(gradeLevelRepository.findById).toHaveBeenCalledWith(
        GRADE_LEVEL_ID,
      );
      expect(mealMenuRepository.save).toHaveBeenCalledTimes(1);
    });

    it("rejects cross-campus destination grade targets", async () => {
      const source = createMealMenu();
      mealMenuRepository.findByIdInCampus.mockResolvedValue(source);
      gradeLevelRepository.findById.mockResolvedValue(
        createGradeLevel({
          id: GRADE_LEVEL_ID,
          campusId: DEFAULT_CAMPUS_ID_B,
        }),
      );

      await expect(
        copyUseCase.execute(source.id, {
          campusId: DEFAULT_CAMPUS_ID_A,
          weekStartDate: NEXT_MONDAY,
          gradeLevelId: GRADE_LEVEL_ID,
        }),
      ).rejects.toThrow(GRADE_LEVEL_NOT_FOUND_MESSAGE);

      expect(mealMenuRepository.save).not.toHaveBeenCalled();
    });

    it("requires an explicit destination gradeLevelId value", async () => {
      await expect(
        copyUseCase.execute("source", {
          campusId: DEFAULT_CAMPUS_ID_A,
          weekStartDate: NEXT_MONDAY,
        }),
      ).rejects.toThrow("gradeLevelId is required for copy destination");

      expect(mealMenuRepository.findByIdInCampus).not.toHaveBeenCalled();
      expect(mealMenuRepository.save).not.toHaveBeenCalled();
    });

    it("returns conflict when another active menu uses the destination natural key", async () => {
      const source = createMealMenu();
      const conflicting = createMealMenu({
        id: "77777777-7777-4777-a777-777777777777",
        weekStartDate: NEXT_MONDAY,
      });
      mealMenuRepository.findByIdInCampus.mockResolvedValue(source);
      mealMenuRepository.findActiveByNaturalKey.mockResolvedValue(conflicting);

      await expect(
        copyUseCase.execute(source.id, {
          campusId: DEFAULT_CAMPUS_ID_A,
          weekStartDate: NEXT_MONDAY,
          gradeLevelId: null,
        }),
      ).rejects.toThrow(DUPLICATE_MEAL_MENU_MESSAGE);

      expect(mealMenuRepository.save).not.toHaveBeenCalled();
    });

    it("rejects non-Monday copy destinations", async () => {
      const source = createMealMenu();
      mealMenuRepository.findByIdInCampus.mockResolvedValue(source);

      await expect(
        copyUseCase.execute(source.id, {
          campusId: DEFAULT_CAMPUS_ID_A,
          weekStartDate: new Date("2026-06-09T00:00:00.000Z"),
          gradeLevelId: null,
        }),
      ).rejects.toThrow("weekStartDate must be a Monday");

      expect(mealMenuRepository.findActiveByNaturalKey).not.toHaveBeenCalled();
      expect(mealMenuRepository.save).not.toHaveBeenCalled();
    });

    it("rejects archived source menus", async () => {
      const archived = createMealMenu({ isArchived: true });
      mealMenuRepository.findByIdInCampus.mockResolvedValue(archived);

      await expect(
        copyUseCase.execute(archived.id, {
          campusId: DEFAULT_CAMPUS_ID_A,
          weekStartDate: NEXT_MONDAY,
          gradeLevelId: null,
        }),
      ).rejects.toThrow("Archived meal menus cannot be copied");

      expect(mealMenuRepository.findActiveByNaturalKey).not.toHaveBeenCalled();
      expect(mealMenuRepository.save).not.toHaveBeenCalled();
    });

    it("returns not found for missing or cross-campus source menus", async () => {
      mealMenuRepository.findByIdInCampus.mockResolvedValue(null);

      await expect(
        copyUseCase.execute("missing", {
          campusId: DEFAULT_CAMPUS_ID_A,
          weekStartDate: NEXT_MONDAY,
          gradeLevelId: null,
        }),
      ).rejects.toThrow("Meal menu with ID missing not found");

      expect(mealMenuRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("GetMealMenusUseCase", () => {
    it("lists active menus for all targets by default", async () => {
      const params = {};
      const menu = createMealMenu();
      mealMenuRepository.findByCampusId.mockResolvedValue({
        data: [menu],
        pagination: PAGINATION,
      });

      const result = await getListUseCase.execute({
        campusId: DEFAULT_CAMPUS_ID_A,
        params,
      });

      expect(result.data).toEqual([menu]);
      expect(mealMenuRepository.findByCampusId).toHaveBeenCalledWith(
        DEFAULT_CAMPUS_ID_A,
        params,
        { includeArchived: false, scope: {} },
      );
    });

    it("allows the isArchived standard filter to include or filter archived menus", async () => {
      const params = { filter: JSON.stringify({ isArchived: true }) };

      await getListUseCase.execute({
        campusId: DEFAULT_CAMPUS_ID_A,
        params,
      });

      expect(mealMenuRepository.findByCampusId).toHaveBeenCalledWith(
        DEFAULT_CAMPUS_ID_A,
        params,
        { includeArchived: true, scope: {} },
      );
    });

    it("supports campus-only target filtering", async () => {
      const params = {};

      await getListUseCase.execute({
        campusId: DEFAULT_CAMPUS_ID_A,
        params,
        target: "campus",
      });

      expect(mealMenuRepository.findByCampusId).toHaveBeenCalledWith(
        DEFAULT_CAMPUS_ID_A,
        params,
        { includeArchived: false, scope: { gradeLevelId: null } },
      );
    });

    it("supports grade target filtering when the grade belongs to the active campus", async () => {
      const params = {};
      gradeLevelRepository.findById.mockResolvedValue(
        createGradeLevel({
          id: GRADE_LEVEL_ID,
          campusId: DEFAULT_CAMPUS_ID_A,
        }),
      );

      await getListUseCase.execute({
        campusId: DEFAULT_CAMPUS_ID_A,
        params,
        target: "grade",
        gradeLevelId: GRADE_LEVEL_ID,
      });

      expect(gradeLevelRepository.findById).toHaveBeenCalledWith(
        GRADE_LEVEL_ID,
      );
      expect(mealMenuRepository.findByCampusId).toHaveBeenCalledWith(
        DEFAULT_CAMPUS_ID_A,
        params,
        { includeArchived: false, scope: { gradeLevelId: GRADE_LEVEL_ID } },
      );
    });

    it("rejects invalid target combinations and cross-campus grade targets", async () => {
      await expect(
        getListUseCase.execute({
          campusId: DEFAULT_CAMPUS_ID_A,
          params: {},
          target: "grade",
        }),
      ).rejects.toThrow("gradeLevelId is required when target=grade");

      await expect(
        getListUseCase.execute({
          campusId: DEFAULT_CAMPUS_ID_A,
          params: {},
          target: "all",
          gradeLevelId: GRADE_LEVEL_ID,
        }),
      ).rejects.toThrow("gradeLevelId is only supported when target=grade");

      await expect(
        getListUseCase.execute({
          campusId: DEFAULT_CAMPUS_ID_A,
          params: {},
          target: "campus",
          gradeLevelId: GRADE_LEVEL_ID,
        }),
      ).rejects.toThrow("gradeLevelId is only supported when target=grade");

      gradeLevelRepository.findById.mockResolvedValue(
        createGradeLevel({
          id: GRADE_LEVEL_ID,
          campusId: DEFAULT_CAMPUS_ID_B,
        }),
      );

      await expect(
        getListUseCase.execute({
          campusId: DEFAULT_CAMPUS_ID_A,
          params: {},
          target: "grade",
          gradeLevelId: GRADE_LEVEL_ID,
        }),
      ).rejects.toThrow(GRADE_LEVEL_NOT_FOUND_MESSAGE);
    });

    it("passes weekStartDate filters and caller sort through to the repository", async () => {
      const params = {
        filter: JSON.stringify({
          weekStartDate: { gte: "2026-06-01", lte: "2026-06-30" },
        }),
        sort: "-weekStartDate",
      };

      await getListUseCase.execute({
        campusId: DEFAULT_CAMPUS_ID_A,
        params,
      });

      expect(mealMenuRepository.findByCampusId).toHaveBeenCalledWith(
        DEFAULT_CAMPUS_ID_A,
        params,
        { includeArchived: false, scope: {} },
      );
    });
  });

  describe("GetMealMenuByIdUseCase", () => {
    it("returns a campus-scoped menu including archived rows", async () => {
      const archived = createMealMenu({ isArchived: true });
      mealMenuRepository.findByIdInCampus.mockResolvedValue(archived);

      const result = await getByIdUseCase.execute(
        DEFAULT_CAMPUS_ID_A,
        archived.id,
      );

      expect(result).toBe(archived);
      expect(mealMenuRepository.findByIdInCampus).toHaveBeenCalledWith(
        DEFAULT_CAMPUS_ID_A,
        archived.id,
      );
    });

    it("returns not found when the menu is missing or outside the campus", async () => {
      mealMenuRepository.findByIdInCampus.mockResolvedValue(null);

      await expect(
        getByIdUseCase.execute(DEFAULT_CAMPUS_ID_A, "missing"),
      ).rejects.toThrow("Meal menu with ID missing not found");
    });
  });

  describe("ArchiveMealMenuUseCase", () => {
    it("archives an active menu", async () => {
      const menu = createMealMenu({ isArchived: false });
      mealMenuRepository.findByIdInCampus.mockResolvedValue(menu);

      const result = await archiveUseCase.execute(DEFAULT_CAMPUS_ID_A, menu.id);

      expect(result.isArchived).toBe(true);
      expect(mealMenuRepository.findByIdInCampus).toHaveBeenCalledWith(
        DEFAULT_CAMPUS_ID_A,
        menu.id,
      );
      expect(mealMenuRepository.archive).toHaveBeenCalledWith(menu);
      expect(unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(transactionContext.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ARCHIVE_MEAL_MENU",
          campusId: DEFAULT_CAMPUS_ID_A,
          targetId: menu.id,
          targetType: "meal_menu",
        }),
      );
    });

    it("treats archiving an already archived menu as idempotent", async () => {
      const archived = createMealMenu({ isArchived: true });
      mealMenuRepository.findByIdInCampus.mockResolvedValue(archived);

      const result = await archiveUseCase.execute(
        DEFAULT_CAMPUS_ID_A,
        archived.id,
      );

      expect(result).toBe(archived);
      expect(result.isArchived).toBe(true);
      expect(mealMenuRepository.archive).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
      expect(transactionContext.recordAudit).not.toHaveBeenCalled();
    });

    it("returns not found when the menu is missing or outside the campus", async () => {
      mealMenuRepository.findByIdInCampus.mockResolvedValue(null);

      await expect(
        archiveUseCase.execute(DEFAULT_CAMPUS_ID_A, "missing"),
      ).rejects.toThrow("Meal menu with ID missing not found");

      expect(mealMenuRepository.archive).not.toHaveBeenCalled();
    });
  });

  describe("RestoreMealMenuUseCase", () => {
    it("restores an archived menu when no active natural-key conflict exists", async () => {
      const archived = createMealMenu({ isArchived: true });
      mealMenuRepository.findByIdInCampus.mockResolvedValue(archived);
      mealMenuRepository.findActiveByNaturalKey.mockResolvedValue(null);

      const result = await restoreUseCase.execute(
        DEFAULT_CAMPUS_ID_A,
        archived.id,
      );

      expect(result.isArchived).toBe(false);
      expect(mealMenuRepository.findByIdInCampus).toHaveBeenCalledWith(
        DEFAULT_CAMPUS_ID_A,
        archived.id,
      );
      expect(mealMenuRepository.findActiveByNaturalKey).toHaveBeenCalledWith(
        {
          campusId: archived.campusId,
          gradeLevelId: archived.gradeLevelId,
          weekStartDate: archived.weekStartDate,
        },
        archived.id,
      );
      expect(mealMenuRepository.restore).toHaveBeenCalledWith(archived);
      expect(unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(transactionContext.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "RESTORE_MEAL_MENU",
          campusId: DEFAULT_CAMPUS_ID_A,
          targetId: archived.id,
          targetType: "meal_menu",
        }),
      );
    });

    it("rejects restoring an active menu", async () => {
      const active = createMealMenu({ isArchived: false });
      mealMenuRepository.findByIdInCampus.mockResolvedValue(active);

      await expect(
        restoreUseCase.execute(DEFAULT_CAMPUS_ID_A, active.id),
      ).rejects.toThrow(`Meal menu with ID ${active.id} is not archived`);

      expect(mealMenuRepository.findActiveByNaturalKey).not.toHaveBeenCalled();
      expect(mealMenuRepository.restore).not.toHaveBeenCalled();
    });

    it("returns not found when the menu is missing or outside the campus", async () => {
      mealMenuRepository.findByIdInCampus.mockResolvedValue(null);

      await expect(
        restoreUseCase.execute(DEFAULT_CAMPUS_ID_A, "missing"),
      ).rejects.toThrow("Meal menu with ID missing not found");

      expect(mealMenuRepository.restore).not.toHaveBeenCalled();
    });

    it("returns conflict when another active menu uses the same natural key", async () => {
      const archived = createMealMenu({ isArchived: true });
      const conflicting = createMealMenu({
        id: "77777777-7777-4777-a777-777777777777",
      });
      mealMenuRepository.findByIdInCampus.mockResolvedValue(archived);
      mealMenuRepository.findActiveByNaturalKey.mockResolvedValue(conflicting);

      await expect(
        restoreUseCase.execute(DEFAULT_CAMPUS_ID_A, archived.id),
      ).rejects.toThrow(DUPLICATE_MEAL_MENU_MESSAGE);

      expect(archived.isArchived).toBe(true);
      expect(mealMenuRepository.restore).not.toHaveBeenCalled();
    });
  });

  describe("UpdateMealMenuUseCase", () => {
    it("updates an active menu with whole-grid replacement", async () => {
      const existing = createMealMenu({
        campusId: DEFAULT_CAMPUS_ID_A,
        weekStartDate: MONDAY,
        entries: [{ dayOfWeek: 1, slot: "Breakfast", description: "Oatmeal" }],
      });
      mealMenuRepository.findByIdInCampus.mockResolvedValue(existing);

      const result = await updateUseCase.execute(existing.id, {
        campusId: DEFAULT_CAMPUS_ID_A,
        weekStartDate: NEXT_MONDAY,
        title: " Updated Menu ",
        days: [2, 3],
        mealSlots: [" Snack "],
        entries: [
          { dayOfWeek: 2, slot: "Snack", description: " Yogurt " },
          { dayOfWeek: 3, slot: "Snack", description: "   " },
        ],
      });

      expect(result.weekStartDate).toEqual(NEXT_MONDAY);
      expect(result.title).toBe("Updated Menu");
      expect(result.days).toEqual([2, 3]);
      expect(result.mealSlots).toEqual(["Snack"]);
      expect(result.entries).toEqual([
        { dayOfWeek: 2, slot: "Snack", description: "Yogurt" },
      ]);
      expect(mealMenuRepository.findActiveByNaturalKey).toHaveBeenCalledWith(
        {
          campusId: DEFAULT_CAMPUS_ID_A,
          gradeLevelId: null,
          weekStartDate: NEXT_MONDAY,
        },
        existing.id,
      );
      expect(mealMenuRepository.update).toHaveBeenCalledTimes(1);
      expect(mealMenuRepository.update.mock.calls[0][0].entries).toEqual([
        { dayOfWeek: 2, slot: "Snack", description: "Yogurt" },
      ]);
      expect(unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(transactionContext.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "UPDATE_MEAL_MENU",
          campusId: DEFAULT_CAMPUS_ID_A,
          targetId: existing.id,
          targetType: "meal_menu",
        }),
      );
    });

    it("updates a grade-level target only when the grade belongs to the campus", async () => {
      const existing = createMealMenu({ campusId: DEFAULT_CAMPUS_ID_A });
      mealMenuRepository.findByIdInCampus.mockResolvedValue(existing);
      gradeLevelRepository.findById.mockResolvedValue(
        createGradeLevel({
          id: GRADE_LEVEL_ID,
          campusId: DEFAULT_CAMPUS_ID_A,
          name: "Kindergarten",
        }),
      );

      const result = await updateUseCase.execute(existing.id, {
        campusId: DEFAULT_CAMPUS_ID_A,
        gradeLevelId: GRADE_LEVEL_ID,
      });

      expect(result.gradeLevelId).toBe(GRADE_LEVEL_ID);
      expect(result.gradeLevel).toEqual({
        id: GRADE_LEVEL_ID,
        name: "Kindergarten",
      });
    });

    it("rejects archived menu updates", async () => {
      const archived = createMealMenu({ isArchived: true });
      mealMenuRepository.findByIdInCampus.mockResolvedValue(archived);

      await expect(
        updateUseCase.execute(archived.id, {
          campusId: DEFAULT_CAMPUS_ID_A,
          title: "Cannot update",
        }),
      ).rejects.toThrow("Archived meal menus cannot be mutated");

      expect(mealMenuRepository.update).not.toHaveBeenCalled();
    });

    it("rejects missing menus and cross-campus grade retargeting", async () => {
      mealMenuRepository.findByIdInCampus.mockResolvedValueOnce(null);

      await expect(
        updateUseCase.execute("missing", {
          campusId: DEFAULT_CAMPUS_ID_A,
          title: "Missing",
        }),
      ).rejects.toThrow("Meal menu with ID missing not found");

      const existing = createMealMenu({ campusId: DEFAULT_CAMPUS_ID_A });
      mealMenuRepository.findByIdInCampus.mockResolvedValueOnce(existing);
      gradeLevelRepository.findById.mockResolvedValueOnce(
        createGradeLevel({
          id: GRADE_LEVEL_ID,
          campusId: DEFAULT_CAMPUS_ID_B,
        }),
      );

      await expect(
        updateUseCase.execute(existing.id, {
          campusId: DEFAULT_CAMPUS_ID_A,
          gradeLevelId: GRADE_LEVEL_ID,
        }),
      ).rejects.toThrow(GRADE_LEVEL_NOT_FOUND_MESSAGE);

      expect(mealMenuRepository.update).not.toHaveBeenCalled();
    });

    it("rejects non-Monday dates, invalid grids, and duplicate update conflicts", async () => {
      const existing = createMealMenu({ campusId: DEFAULT_CAMPUS_ID_A });
      mealMenuRepository.findByIdInCampus.mockResolvedValue(existing);

      await expect(
        updateUseCase.execute(existing.id, {
          campusId: DEFAULT_CAMPUS_ID_A,
          weekStartDate: new Date("2026-06-02T00:00:00.000Z"),
        }),
      ).rejects.toThrow("weekStartDate must be a Monday");

      await expect(
        updateUseCase.execute(existing.id, {
          campusId: DEFAULT_CAMPUS_ID_A,
          days: [1],
          entries: [{ dayOfWeek: 2, slot: "Breakfast", description: "Toast" }],
        }),
      ).rejects.toThrow("Entry dayOfWeek must exist in menu days");

      mealMenuRepository.findActiveByNaturalKey.mockResolvedValueOnce(
        createMealMenu({ id: "77777777-7777-4777-a777-777777777777" }),
      );

      await expect(
        updateUseCase.execute(existing.id, {
          campusId: DEFAULT_CAMPUS_ID_A,
          title: "Conflict",
        }),
      ).rejects.toThrow(DUPLICATE_MEAL_MENU_MESSAGE);
    });
  });
});
