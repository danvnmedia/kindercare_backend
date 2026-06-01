import {
  ArchiveMealMenuUseCase,
  CopyMealMenuUseCase,
  CreateMealMenuUseCase,
  GetMealMenuByIdUseCase,
  GetMealMenusUseCase,
  RestoreMealMenuUseCase,
  UpdateMealMenuUseCase,
} from "@/application/meal-menu";
import { User } from "@/domain/user-management/user.entity";
import { createMealMenu, DEFAULT_CAMPUS_ID_A } from "@/test-utils";

import { MealMenuController } from "./meal-menu.controller";

const MONDAY_STRING = "2026-06-01";
const MONDAY_DATE = new Date(MONDAY_STRING);
const MENU_ID = "33333333-3333-4333-a333-333333333333";
const GRADE_LEVEL_ID = "55555555-5555-4555-a555-555555555555";
const CURRENT_USER = { id: "99999999-9999-4999-a999-999999999999" } as User;
const PAGINATION = {
  count: 1,
  limit: 10,
  offset: 0,
  totalPages: 1,
  currentPage: 1,
  hasNext: false,
  hasPrev: false,
};

describe("MealMenuController", () => {
  let getListUseCase: jest.Mocked<GetMealMenusUseCase>;
  let getByIdUseCase: jest.Mocked<GetMealMenuByIdUseCase>;
  let archiveUseCase: jest.Mocked<ArchiveMealMenuUseCase>;
  let copyUseCase: jest.Mocked<CopyMealMenuUseCase>;
  let createUseCase: jest.Mocked<CreateMealMenuUseCase>;
  let restoreUseCase: jest.Mocked<RestoreMealMenuUseCase>;
  let updateUseCase: jest.Mocked<UpdateMealMenuUseCase>;
  let controller: MealMenuController;

  beforeEach(() => {
    getListUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetMealMenusUseCase>;
    getByIdUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetMealMenuByIdUseCase>;
    archiveUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ArchiveMealMenuUseCase>;
    copyUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CopyMealMenuUseCase>;
    createUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CreateMealMenuUseCase>;
    restoreUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<RestoreMealMenuUseCase>;
    updateUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<UpdateMealMenuUseCase>;
    controller = new MealMenuController(
      getListUseCase,
      getByIdUseCase,
      archiveUseCase,
      copyUseCase,
      createUseCase,
      restoreUseCase,
      updateUseCase,
    );
  });

  it("threads campus context and query into GET /meal-menus", async () => {
    const query = {
      target: "grade" as const,
      gradeLevelId: GRADE_LEVEL_ID,
      filter: JSON.stringify({ isArchived: true }),
      sort: "-weekStartDate",
      limit: 10,
      offset: 0,
    };
    const menu = createMealMenu();
    const paginatedResult = { data: [menu], pagination: PAGINATION };
    getListUseCase.execute.mockResolvedValue(paginatedResult);

    const result = await controller.findAll(DEFAULT_CAMPUS_ID_A, query);

    expect(getListUseCase.execute).toHaveBeenCalledWith({
      campusId: DEFAULT_CAMPUS_ID_A,
      params: query,
      target: query.target,
      gradeLevelId: query.gradeLevelId,
    });
    expect(result).toBe(paginatedResult);
  });

  it("threads campus context and id into GET /meal-menus/:id", async () => {
    const menu = createMealMenu({ id: MENU_ID, isArchived: true });
    getByIdUseCase.execute.mockResolvedValue(menu);

    const result = await controller.findById(DEFAULT_CAMPUS_ID_A, MENU_ID);

    expect(getByIdUseCase.execute).toHaveBeenCalledWith(
      DEFAULT_CAMPUS_ID_A,
      MENU_ID,
    );
    expect(result).toBe(menu);
  });

  it("threads campus context, id, and actor into DELETE /meal-menus/:id", async () => {
    const menu = createMealMenu({ id: MENU_ID, isArchived: true });
    archiveUseCase.execute.mockResolvedValue(menu);

    const result = await controller.archive(
      DEFAULT_CAMPUS_ID_A,
      MENU_ID,
      CURRENT_USER,
    );

    expect(archiveUseCase.execute).toHaveBeenCalledWith(
      DEFAULT_CAMPUS_ID_A,
      MENU_ID,
      CURRENT_USER,
    );
    expect(result).toBe(menu);
  });

  it("threads campus context, id, and actor into PATCH /meal-menus/:id/restore", async () => {
    const menu = createMealMenu({ id: MENU_ID, isArchived: false });
    restoreUseCase.execute.mockResolvedValue(menu);

    const result = await controller.restore(
      DEFAULT_CAMPUS_ID_A,
      MENU_ID,
      CURRENT_USER,
    );

    expect(restoreUseCase.execute).toHaveBeenCalledWith(
      DEFAULT_CAMPUS_ID_A,
      MENU_ID,
      CURRENT_USER,
    );
    expect(result).toBe(menu);
  });

  it("threads campus context, source id, body, and actor into POST /meal-menus/:id/copy", async () => {
    const dto = {
      weekStartDate: "2026-06-08",
      gradeLevelId: GRADE_LEVEL_ID,
      title: "Copied Menu",
    };
    const menu = createMealMenu({ title: dto.title });
    copyUseCase.execute.mockResolvedValue(menu);

    const result = await controller.copy(
      DEFAULT_CAMPUS_ID_A,
      MENU_ID,
      dto,
      CURRENT_USER,
    );

    expect(copyUseCase.execute).toHaveBeenCalledWith(
      MENU_ID,
      {
        campusId: DEFAULT_CAMPUS_ID_A,
        weekStartDate: new Date("2026-06-08"),
        gradeLevelId: dto.gradeLevelId,
        title: dto.title,
      },
      CURRENT_USER,
    );
    expect(result).toBe(menu);
  });

  it("threads campus context, body, and actor into POST /meal-menus", async () => {
    const dto = {
      weekStartDate: MONDAY_STRING,
      gradeLevelId: null,
      title: "Weekly Menu",
      entries: [{ dayOfWeek: 1, slot: "Breakfast", description: "Oatmeal" }],
    };
    const menu = createMealMenu({ title: dto.title, entries: dto.entries });
    createUseCase.execute.mockResolvedValue(menu);

    const result = await controller.create(
      DEFAULT_CAMPUS_ID_A,
      dto,
      CURRENT_USER,
    );

    expect(createUseCase.execute).toHaveBeenCalledWith(
      {
        campusId: DEFAULT_CAMPUS_ID_A,
        weekStartDate: MONDAY_DATE,
        gradeLevelId: null,
        title: "Weekly Menu",
        days: undefined,
        mealSlots: undefined,
        entries: dto.entries,
      },
      CURRENT_USER,
    );
    expect(result).toBe(menu);
  });

  it("threads campus context, id, body, and actor into PATCH /meal-menus/:id", async () => {
    const dto = {
      weekStartDate: "2026-06-08",
      gradeLevelId: GRADE_LEVEL_ID,
      title: "Updated Menu",
      days: [2, 3],
      mealSlots: ["Snack"],
      entries: [{ dayOfWeek: 2, slot: "Snack", description: "Yogurt" }],
    };
    const menu = createMealMenu({
      title: dto.title,
      days: dto.days,
      mealSlots: dto.mealSlots,
      entries: dto.entries,
    });
    updateUseCase.execute.mockResolvedValue(menu);

    const result = await controller.update(
      DEFAULT_CAMPUS_ID_A,
      MENU_ID,
      dto,
      CURRENT_USER,
    );

    expect(updateUseCase.execute).toHaveBeenCalledWith(
      MENU_ID,
      {
        campusId: DEFAULT_CAMPUS_ID_A,
        weekStartDate: new Date("2026-06-08"),
        gradeLevelId: dto.gradeLevelId,
        title: dto.title,
        days: dto.days,
        mealSlots: dto.mealSlots,
        entries: dto.entries,
      },
      CURRENT_USER,
    );
    expect(result).toBe(menu);
  });
});
