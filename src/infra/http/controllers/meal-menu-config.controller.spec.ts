import {
  GetMealMenuConfigUseCase,
  UpdateMealMenuConfigUseCase,
} from "@/application/meal-menu";
import { User } from "@/domain/user-management/user.entity";
import { createMealMenuConfig, DEFAULT_CAMPUS_ID_A } from "@/test-utils";

import { MealMenuConfigController } from "./meal-menu-config.controller";

const CURRENT_USER = { id: "99999999-9999-4999-a999-999999999999" } as User;

describe("MealMenuConfigController", () => {
  let getUseCase: jest.Mocked<GetMealMenuConfigUseCase>;
  let updateUseCase: jest.Mocked<UpdateMealMenuConfigUseCase>;
  let controller: MealMenuConfigController;

  beforeEach(() => {
    getUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetMealMenuConfigUseCase>;
    updateUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<UpdateMealMenuConfigUseCase>;
    controller = new MealMenuConfigController(getUseCase, updateUseCase);
  });

  it("threads campus context into GET /meal-menus/config", async () => {
    const config = createMealMenuConfig();
    getUseCase.execute.mockResolvedValue(config);

    const result = await controller.getConfig(DEFAULT_CAMPUS_ID_A);

    expect(getUseCase.execute).toHaveBeenCalledWith(DEFAULT_CAMPUS_ID_A);
    expect(result).toBe(config);
  });

  it("threads campus context, body, and actor into PUT /meal-menus/config", async () => {
    const dto = {
      operatingDays: [1, 2, 3, 4, 5, 6],
      defaultMealSlots: ["Breakfast", "Lunch", "Snack"],
    };
    const config = createMealMenuConfig(dto);
    updateUseCase.execute.mockResolvedValue(config);

    const result = await controller.updateConfig(
      DEFAULT_CAMPUS_ID_A,
      dto,
      CURRENT_USER,
    );

    expect(updateUseCase.execute).toHaveBeenCalledWith(
      DEFAULT_CAMPUS_ID_A,
      dto,
      CURRENT_USER,
    );
    expect(result).toBe(config);
  });
});
