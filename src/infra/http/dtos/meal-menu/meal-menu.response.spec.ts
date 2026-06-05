import { instanceToPlain, plainToInstance } from "class-transformer";

import { MealMenu } from "@/domain/meal-menu";

import { EffectiveClassMealMenuResponse } from "./effective-class-meal-menu.response";
import { MealMenuResponse } from "./meal-menu.response";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const GRADE_LEVEL_ID = "55555555-5555-4555-a555-555555555555";
const CLASS_ID = "66666666-6666-4666-a666-666666666666";

describe("MealMenuResponse", () => {
  it("exposes explicit class target context", () => {
    const menu = MealMenu.create({
      campusId: CAMPUS_ID,
      targetType: "class",
      gradeLevelId: null,
      classId: CLASS_ID,
      gradeLevel: null,
      classroom: {
        id: CLASS_ID,
        name: "K1 Room A",
        gradeLevelId: GRADE_LEVEL_ID,
      },
      weekStartDate: new Date("2026-06-01T00:00:00.000Z"),
      title: "Class Menu",
      days: [1, 2, 3, 4, 5],
      mealSlots: ["Breakfast"],
      entries: [{ dayOfWeek: 1, slot: "Breakfast", description: "Oatmeal" }],
    });

    const response = plainToInstance(MealMenuResponse, menu.toPlain(), {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
      exposeUnsetFields: false,
    });

    expect(instanceToPlain(response)).toEqual(
      expect.objectContaining({
        targetType: "class",
        gradeLevelId: null,
        classId: CLASS_ID,
        gradeLevel: null,
        classroom: {
          id: CLASS_ID,
          name: "K1 Room A",
          gradeLevelId: GRADE_LEVEL_ID,
        },
      }),
    );
  });
});

describe("EffectiveClassMealMenuResponse", () => {
  it("exposes resolved target type and nested menu", () => {
    const menu = MealMenu.create({
      campusId: CAMPUS_ID,
      targetType: "campus",
      gradeLevelId: null,
      classId: null,
      gradeLevel: null,
      classroom: null,
      weekStartDate: new Date("2026-06-01T00:00:00.000Z"),
      title: "Campus Menu",
      days: [1, 2, 3, 4, 5],
      mealSlots: ["Breakfast"],
      entries: [{ dayOfWeek: 1, slot: "Breakfast", description: "Oatmeal" }],
    });

    const response = plainToInstance(
      EffectiveClassMealMenuResponse,
      {
        resolvedTargetType: "campus",
        menu: menu.toPlain(),
      },
      {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
        exposeUnsetFields: false,
      },
    );

    expect(instanceToPlain(response)).toEqual(
      expect.objectContaining({
        resolvedTargetType: "campus",
        menu: expect.objectContaining({
          targetType: "campus",
          gradeLevelId: null,
          classId: null,
        }),
      }),
    );
  });

  it("exposes menu null for valid no-match lookups", () => {
    const response = plainToInstance(
      EffectiveClassMealMenuResponse,
      {
        resolvedTargetType: null,
        menu: null,
      },
      {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
        exposeUnsetFields: false,
      },
    );

    expect(instanceToPlain(response)).toEqual({
      resolvedTargetType: null,
      menu: null,
    });
  });
});
