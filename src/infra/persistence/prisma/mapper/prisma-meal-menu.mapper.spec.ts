import {
  GradeLevel as PrismaGradeLevel,
  MealMenu as PrismaMealMenu,
  MealMenuEntry as PrismaMealMenuEntry,
} from "@prisma/client";
import { MealMenu, MealMenuConfig } from "@/domain/meal-menu";
import { PrismaMealMenuMapper } from "./prisma-meal-menu.mapper";
import { PrismaMealMenuConfigMapper } from "./prisma-meal-menu-config.mapper";

const baseMenuRow = (): PrismaMealMenu => ({
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
});

const entryRow = (
  overrides: Partial<PrismaMealMenuEntry> = {},
): PrismaMealMenuEntry => ({
  id: "44444444-4444-4444-a444-444444444444",
  mealMenuId: "33333333-3333-4333-a333-333333333333",
  dayOfWeek: 1,
  slot: "Breakfast",
  description: "Oatmeal",
  createdAt: new Date("2026-05-30T00:00:00.000Z"),
  updatedAt: new Date("2026-05-30T00:00:00.000Z"),
  ...overrides,
});

const gradeLevelRow = (): PrismaGradeLevel => ({
  id: "55555555-5555-4555-a555-555555555555",
  campusId: "11111111-1111-4111-a111-111111111111",
  name: "Kindergarten",
  order: 1,
  isArchived: false,
  createdAt: new Date("2026-05-30T00:00:00.000Z"),
  updatedAt: new Date("2026-05-30T00:00:00.000Z"),
});

describe("PrismaMealMenuMapper", () => {
  it("hydrates entries and grade-level snapshot", () => {
    const gradeLevel = gradeLevelRow();
    const menu = PrismaMealMenuMapper.toDomain({
      ...baseMenuRow(),
      gradeLevelId: gradeLevel.id,
      entries: [entryRow()],
      gradeLevel,
    });

    expect(menu.entries).toEqual([
      { dayOfWeek: 1, slot: "Breakfast", description: "Oatmeal" },
    ]);
    expect(menu.gradeLevel).toEqual({
      id: gradeLevel.id,
      name: gradeLevel.name,
    });
  });

  it("uses UncheckedUpdateInput shape for mutable FK fields", () => {
    const menu = MealMenu.create(
      {
        campusId: "11111111-1111-4111-a111-111111111111",
        gradeLevelId: "55555555-5555-4555-a555-555555555555",
        weekStartDate: new Date("2026-06-01T00:00:00.000Z"),
        title: "Menu",
        entries: [{ dayOfWeek: 1, slot: "Breakfast", description: "Oatmeal" }],
      },
      "33333333-3333-4333-a333-333333333333",
    );

    const updateData = PrismaMealMenuMapper.toPrismaUpdate(menu);

    expect(updateData.gradeLevelId).toBe(
      "55555555-5555-4555-a555-555555555555",
    );
    expect(updateData).not.toHaveProperty("id");
    expect(updateData).not.toHaveProperty("campusId");
    expect(updateData).not.toHaveProperty("createdAt");
    expect(updateData).not.toHaveProperty("entries");
  });

  it("maps normalized entries to nested Prisma create input", () => {
    const menu = MealMenu.create({
      campusId: "11111111-1111-4111-a111-111111111111",
      weekStartDate: new Date("2026-06-01T00:00:00.000Z"),
      entries: [
        { dayOfWeek: 1, slot: " Breakfast ", description: " Oatmeal " },
      ],
    });

    expect(PrismaMealMenuMapper.toPrismaEntryCreate(menu.entries[0])).toEqual({
      dayOfWeek: 1,
      slot: "Breakfast",
      description: "Oatmeal",
    });
  });
});

describe("PrismaMealMenuConfigMapper", () => {
  it("maps config to update input without immutable fields", () => {
    const config = MealMenuConfig.create(
      {
        campusId: "11111111-1111-4111-a111-111111111111",
        operatingDays: [1, 2, 3, 4, 5],
        defaultMealSlots: ["Breakfast", "Lunch", "Afternoon"],
      },
      "66666666-6666-4666-a666-666666666666",
    );

    const updateData = PrismaMealMenuConfigMapper.toPrismaUpdate(config);

    expect(updateData.operatingDays).toEqual([1, 2, 3, 4, 5]);
    expect(updateData.defaultMealSlots).toEqual([
      "Breakfast",
      "Lunch",
      "Afternoon",
    ]);
    expect(updateData).not.toHaveProperty("id");
    expect(updateData).not.toHaveProperty("campusId");
    expect(updateData).not.toHaveProperty("createdAt");
  });
});
