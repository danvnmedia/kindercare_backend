import { BadRequestException } from "@nestjs/common";

import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";

import { MealMenuConfigRepository } from "../../ports";
import {
  createMealMenu,
  createMealMenuConfig,
  createMockMealMenuConfigRepository,
  DEFAULT_CAMPUS_ID_A,
} from "@/test-utils";

import { GetMealMenuConfigUseCase } from "./get-meal-menu-config.use-case";
import { UpdateMealMenuConfigUseCase } from "./update-meal-menu-config.use-case";

describe("MealMenuConfig use cases", () => {
  let repository: jest.Mocked<MealMenuConfigRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let transactionContext: jest.Mocked<
    Pick<TransactionContext, "recordAudit" | "upsertMealMenuConfig">
  >;
  let getUseCase: GetMealMenuConfigUseCase;
  let updateUseCase: UpdateMealMenuConfigUseCase;

  beforeEach(() => {
    repository = createMockMealMenuConfigRepository();
    transactionContext = {
      recordAudit: jest.fn(),
      upsertMealMenuConfig: jest.fn((config) => repository.upsert(config)),
    } as jest.Mocked<
      Pick<TransactionContext, "recordAudit" | "upsertMealMenuConfig">
    >;
    unitOfWork = {
      run: jest.fn((task) =>
        task(transactionContext as unknown as TransactionContext),
      ),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    getUseCase = new GetMealMenuConfigUseCase(repository);
    updateUseCase = new UpdateMealMenuConfigUseCase(repository, unitOfWork);
  });

  describe("GetMealMenuConfigUseCase", () => {
    it("returns an existing config row when one exists", async () => {
      const existing = createMealMenuConfig({
        operatingDays: [1, 2, 3, 6],
        defaultMealSlots: ["Breakfast", "Lunch", "Snack"],
      });
      repository.findByCampusId.mockResolvedValue(existing);

      const result = await getUseCase.execute(DEFAULT_CAMPUS_ID_A);

      expect(result).toBe(existing);
      expect(repository.findByCampusId).toHaveBeenCalledWith(
        DEFAULT_CAMPUS_ID_A,
      );
      expect(repository.save).not.toHaveBeenCalled();
      expect(repository.upsert).not.toHaveBeenCalled();
    });

    it("returns virtual defaults without creating a row when no config exists", async () => {
      repository.findByCampusId.mockResolvedValue(null);

      const result = await getUseCase.execute(DEFAULT_CAMPUS_ID_A);

      expect(result.campusId).toBe(DEFAULT_CAMPUS_ID_A);
      expect(result.operatingDays).toEqual([1, 2, 3, 4, 5]);
      expect(result.defaultMealSlots).toEqual([
        "Breakfast",
        "Lunch",
        "Afternoon",
      ]);
      expect(repository.save).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
      expect(repository.upsert).not.toHaveBeenCalled();
    });
  });

  describe("UpdateMealMenuConfigUseCase", () => {
    beforeEach(() => {
      repository.upsert.mockImplementation(async (config) => config);
    });

    it("updates an existing config and upserts one row per campus", async () => {
      const existing = createMealMenuConfig();
      repository.findByCampusId.mockResolvedValue(existing);

      const result = await updateUseCase.execute(DEFAULT_CAMPUS_ID_A, {
        operatingDays: [1, 2, 3, 6],
        defaultMealSlots: [" Breakfast ", "Lunch", " Snack "],
      });

      expect(result.operatingDays).toEqual([1, 2, 3, 6]);
      expect(result.defaultMealSlots).toEqual(["Breakfast", "Lunch", "Snack"]);
      expect(repository.upsert).toHaveBeenCalledTimes(1);
      expect(repository.upsert.mock.calls[0][0].campusId).toBe(
        DEFAULT_CAMPUS_ID_A,
      );
      expect(unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(transactionContext.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "UPDATE_MEAL_MENU_CONFIG",
          campusId: DEFAULT_CAMPUS_ID_A,
          targetId: result.id,
          targetType: "meal_menu_config",
        }),
      );
    });

    it("creates a default domain object before upsert when no config exists", async () => {
      repository.findByCampusId.mockResolvedValue(null);

      const result = await updateUseCase.execute(DEFAULT_CAMPUS_ID_A, {
        operatingDays: [1, 2, 3, 4, 5, 6],
        defaultMealSlots: ["Breakfast", "Lunch", "Afternoon", "Snack"],
      });

      expect(result.campusId).toBe(DEFAULT_CAMPUS_ID_A);
      expect(result.operatingDays).toEqual([1, 2, 3, 4, 5, 6]);
      expect(result.defaultMealSlots).toEqual([
        "Breakfast",
        "Lunch",
        "Afternoon",
        "Snack",
      ]);
      expect(repository.upsert).toHaveBeenCalledTimes(1);
    });

    it("rejects invalid config arrays before persistence", async () => {
      repository.findByCampusId.mockResolvedValue(createMealMenuConfig());

      await expect(
        updateUseCase.execute(DEFAULT_CAMPUS_ID_A, {
          operatingDays: [1, 8],
          defaultMealSlots: ["Breakfast", "Lunch"],
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        updateUseCase.execute(DEFAULT_CAMPUS_ID_A, {
          operatingDays: [1, 2, 3],
          defaultMealSlots: ["Breakfast", " Breakfast "],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.upsert).not.toHaveBeenCalled();
    });

    it("does not mutate existing menu snapshots when config changes", async () => {
      const existingMenu = createMealMenu({
        days: [1, 2, 3, 4, 5],
        mealSlots: ["Breakfast", "Lunch", "Afternoon"],
      });
      repository.findByCampusId.mockResolvedValue(createMealMenuConfig());

      await updateUseCase.execute(DEFAULT_CAMPUS_ID_A, {
        operatingDays: [1, 2, 3, 4, 5, 6],
        defaultMealSlots: ["Breakfast", "Lunch", "Snack"],
      });

      expect(existingMenu.days).toEqual([1, 2, 3, 4, 5]);
      expect(existingMenu.mealSlots).toEqual([
        "Breakfast",
        "Lunch",
        "Afternoon",
      ]);
    });
  });
});
