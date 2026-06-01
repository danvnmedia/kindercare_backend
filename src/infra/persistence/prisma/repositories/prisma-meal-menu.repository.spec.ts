import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { MealMenu, MealMenuConfig } from "@/domain/meal-menu";
import { PrismaMealMenuMapper } from "../mapper/prisma-meal-menu.mapper";
import { PrismaService } from "../prisma.service";
import { PrismaMealMenuConfigRepository } from "./prisma-meal-menu-config.repository";
import { PrismaMealMenuRepository } from "./prisma-meal-menu.repository";

type MealMenuDelegateMock = {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

type MealMenuConfigDelegateMock = {
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  upsert: jest.Mock;
};

const mealMenuRowFactory = (overrides: Record<string, unknown> = {}) => ({
  id: "33333333-3333-4333-a333-333333333333",
  campusId: "11111111-1111-4111-a111-111111111111",
  gradeLevelId: null,
  weekStartDate: new Date("2026-06-01T00:00:00.000Z"),
  title: null,
  days: [1, 2, 3, 4, 5],
  mealSlots: ["Breakfast", "Lunch", "Afternoon"],
  isArchived: false,
  createdAt: new Date("2026-05-30T00:00:00.000Z"),
  updatedAt: new Date("2026-05-30T00:00:00.000Z"),
  entries: [
    {
      id: "44444444-4444-4444-a444-444444444444",
      mealMenuId: "33333333-3333-4333-a333-333333333333",
      dayOfWeek: 1,
      slot: "Breakfast",
      description: "Oatmeal",
      createdAt: new Date("2026-05-30T00:00:00.000Z"),
      updatedAt: new Date("2026-05-30T00:00:00.000Z"),
    },
  ],
  gradeLevel: null,
  ...overrides,
});

const configRowFactory = (overrides: Record<string, unknown> = {}) => ({
  id: "66666666-6666-4666-a666-666666666666",
  campusId: "11111111-1111-4111-a111-111111111111",
  operatingDays: [1, 2, 3, 4, 5],
  defaultMealSlots: ["Breakfast", "Lunch", "Afternoon"],
  createdAt: new Date("2026-05-30T00:00:00.000Z"),
  updatedAt: new Date("2026-05-30T00:00:00.000Z"),
  ...overrides,
});

describe("PrismaMealMenuRepository", () => {
  let repository: PrismaMealMenuRepository;
  let mealMenuDelegate: MealMenuDelegateMock;
  let queryService: jest.Mocked<PrismaQueryService>;
  let prisma: { mealMenu: MealMenuDelegateMock };

  beforeEach(() => {
    mealMenuDelegate = {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    prisma = { mealMenu: mealMenuDelegate };
    queryService = {
      executeQuery: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    } as unknown as jest.Mocked<PrismaQueryService>;

    repository = new PrismaMealMenuRepository(
      prisma as unknown as PrismaService,
      queryService,
    );
  });

  it("findByCampusId applies campus and active scopes through PrismaQueryService", async () => {
    const params = {};

    await repository.findByCampusId(
      "11111111-1111-4111-a111-111111111111",
      params,
    );

    expect(queryService.executeQuery).toHaveBeenCalledTimes(1);
    const [, modelName, passedParams, options, mapper] =
      queryService.executeQuery.mock.calls[0];
    const queryOptions = options as Record<string, any>;

    expect(modelName).toBe("mealMenu");
    expect(passedParams.allowedFilterFields).toEqual(
      expect.arrayContaining(["weekStartDate", "isArchived"]),
    );
    expect(passedParams.allowedFilterFields).not.toContain("gradeLevelId");
    expect(queryOptions.scope).toEqual({
      campusId: "11111111-1111-4111-a111-111111111111",
      isArchived: false,
    });
    expect(queryOptions.orderBy).toEqual({ weekStartDate: "desc" });
    expect(mapper).toBe(PrismaMealMenuMapper);
  });

  it("findByCampusId allows caller filters to include archived menus", async () => {
    const params = {};

    await repository.findByCampusId(
      "11111111-1111-4111-a111-111111111111",
      params,
      { includeArchived: true, scope: { gradeLevelId: null } },
    );

    const [, , , options] = queryService.executeQuery.mock.calls[0];
    const queryOptions = options as Record<string, any>;

    expect(queryOptions.scope).toEqual({
      gradeLevelId: null,
      campusId: "11111111-1111-4111-a111-111111111111",
    });
  });

  it("findActiveByNaturalKey supports whole-campus gradeLevelId=null", async () => {
    mealMenuDelegate.findFirst.mockResolvedValue(mealMenuRowFactory());

    await repository.findActiveByNaturalKey({
      campusId: "11111111-1111-4111-a111-111111111111",
      gradeLevelId: null,
      weekStartDate: new Date("2026-06-01T00:00:00.000Z"),
    });

    expect(mealMenuDelegate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campusId: "11111111-1111-4111-a111-111111111111",
          gradeLevelId: null,
          weekStartDate: new Date("2026-06-01T00:00:00.000Z"),
          isArchived: false,
        }),
      }),
    );
  });

  it("save persists normalized child entries with the parent row", async () => {
    const menu = MealMenu.create(
      {
        campusId: "11111111-1111-4111-a111-111111111111",
        weekStartDate: new Date("2026-06-01T00:00:00.000Z"),
        entries: [
          { dayOfWeek: 1, slot: " Breakfast ", description: " Oatmeal " },
        ],
      },
      "33333333-3333-4333-a333-333333333333",
    );
    mealMenuDelegate.create.mockResolvedValue(mealMenuRowFactory());

    await repository.save(menu);

    const createArg = mealMenuDelegate.create.mock.calls[0][0];
    expect(createArg.data.campusId).toBe(
      "11111111-1111-4111-a111-111111111111",
    );
    expect(createArg.data.entries.create).toEqual([
      { dayOfWeek: 1, slot: "Breakfast", description: "Oatmeal" },
    ]);
  });

  it("archive marks the menu archived without hard deleting it", async () => {
    const menu = MealMenu.create(
      {
        campusId: "11111111-1111-4111-a111-111111111111",
        weekStartDate: new Date("2026-06-01T00:00:00.000Z"),
      },
      "33333333-3333-4333-a333-333333333333",
    );
    menu.archive();
    mealMenuDelegate.update.mockResolvedValue(
      mealMenuRowFactory({ isArchived: true, updatedAt: menu.updatedAt }),
    );

    await repository.archive(menu);

    expect(mealMenuDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: menu.id },
        data: { isArchived: true, updatedAt: menu.updatedAt },
      }),
    );
  });

  it("restore marks the menu active without replacing entries", async () => {
    const menu = MealMenu.create(
      {
        campusId: "11111111-1111-4111-a111-111111111111",
        weekStartDate: new Date("2026-06-01T00:00:00.000Z"),
        isArchived: true,
      },
      "33333333-3333-4333-a333-333333333333",
    );
    menu.restore();
    mealMenuDelegate.update.mockResolvedValue(
      mealMenuRowFactory({ isArchived: false, updatedAt: menu.updatedAt }),
    );

    await repository.restore(menu);

    expect(mealMenuDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: menu.id },
        data: { isArchived: false, updatedAt: menu.updatedAt },
      }),
    );
  });

  it("update uses FK-capable parent update data and replaces entries", async () => {
    const menu = MealMenu.create(
      {
        campusId: "11111111-1111-4111-a111-111111111111",
        gradeLevelId: "55555555-5555-4555-a555-555555555555",
        weekStartDate: new Date("2026-06-01T00:00:00.000Z"),
        entries: [{ dayOfWeek: 1, slot: "Breakfast", description: "Oatmeal" }],
      },
      "33333333-3333-4333-a333-333333333333",
    );
    mealMenuDelegate.update.mockResolvedValue(
      mealMenuRowFactory({ gradeLevelId: menu.gradeLevelId }),
    );

    await repository.update(menu);

    const updateArg = mealMenuDelegate.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: menu.id });
    expect(updateArg.data.gradeLevelId).toBe(
      "55555555-5555-4555-a555-555555555555",
    );
    expect(updateArg.data.entries).toEqual({
      deleteMany: {},
      create: [{ dayOfWeek: 1, slot: "Breakfast", description: "Oatmeal" }],
    });
  });
});

describe("PrismaMealMenuConfigRepository", () => {
  let repository: PrismaMealMenuConfigRepository;
  let mealMenuConfigDelegate: MealMenuConfigDelegateMock;
  let prisma: { mealMenuConfig: MealMenuConfigDelegateMock };

  beforeEach(() => {
    mealMenuConfigDelegate = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    };
    prisma = { mealMenuConfig: mealMenuConfigDelegate };
    repository = new PrismaMealMenuConfigRepository(
      prisma as unknown as PrismaService,
    );
  });

  it("findByCampusId uses the campusId unique key", async () => {
    mealMenuConfigDelegate.findUnique.mockResolvedValue(configRowFactory());

    const config = await repository.findByCampusId(
      "11111111-1111-4111-a111-111111111111",
    );

    expect(mealMenuConfigDelegate.findUnique).toHaveBeenCalledWith({
      where: { campusId: "11111111-1111-4111-a111-111111111111" },
    });
    expect(config?.defaultMealSlots).toEqual([
      "Breakfast",
      "Lunch",
      "Afternoon",
    ]);
  });

  it("upsert writes one config row per campus", async () => {
    const config = MealMenuConfig.create(
      { campusId: "11111111-1111-4111-a111-111111111111" },
      "66666666-6666-4666-a666-666666666666",
    );
    mealMenuConfigDelegate.upsert.mockResolvedValue(configRowFactory());

    await repository.upsert(config);

    const upsertArg = mealMenuConfigDelegate.upsert.mock.calls[0][0];
    expect(upsertArg.where).toEqual({
      campusId: "11111111-1111-4111-a111-111111111111",
    });
    expect(upsertArg.create.campusId).toBe(
      "11111111-1111-4111-a111-111111111111",
    );
    expect(upsertArg.update.operatingDays).toEqual([1, 2, 3, 4, 5]);
  });
});
