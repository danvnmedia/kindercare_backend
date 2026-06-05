import {
  Class as PrismaClass,
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
  targetType: "campus",
  gradeLevelId: null,
  classId: null,
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

const classRow = (): PrismaClass => ({
  id: "77777777-7777-4777-a777-777777777777",
  campusId: "11111111-1111-4111-a111-111111111111",
  gradeLevelId: "55555555-5555-4555-a555-555555555555",
  schoolYearId: "88888888-8888-4888-a888-888888888888",
  name: "Room 101",
  description: null,
  createdAt: new Date("2026-05-30T00:00:00.000Z"),
  updatedAt: new Date("2026-05-30T00:00:00.000Z"),
});

describe("PrismaMealMenuMapper", () => {
  it("hydrates entries and grade-level snapshot", () => {
    const gradeLevel = gradeLevelRow();
    const menu = PrismaMealMenuMapper.toDomain({
      ...baseMenuRow(),
      targetType: "grade",
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

  it("hydrates class target identity and snapshot", () => {
    const classroom = classRow();
    const menu = PrismaMealMenuMapper.toDomain({
      ...baseMenuRow(),
      targetType: "class",
      classId: classroom.id,
      class: classroom,
    });

    expect(menu.targetIdentity).toEqual({
      targetType: "class",
      gradeLevelId: null,
      classId: classroom.id,
    });
    expect(menu.classroom).toEqual({
      id: classroom.id,
      name: classroom.name,
      gradeLevelId: classroom.gradeLevelId,
    });
  });

  it("uses UncheckedUpdateInput shape for mutable FK fields", () => {
    const menu = MealMenu.create(
      {
        campusId: "11111111-1111-4111-a111-111111111111",
        targetType: "grade",
        gradeLevelId: "55555555-5555-4555-a555-555555555555",
        weekStartDate: new Date("2026-06-01T00:00:00.000Z"),
        title: "Menu",
        entries: [{ dayOfWeek: 1, slot: "Breakfast", description: "Oatmeal" }],
      },
      "33333333-3333-4333-a333-333333333333",
    );

    const updateData = PrismaMealMenuMapper.toPrismaUpdate(menu);

    expect(updateData.targetType).toBe("grade");
    expect(updateData.gradeLevelId).toBe(
      "55555555-5555-4555-a555-555555555555",
    );
    expect(updateData.classId).toBeNull();
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
