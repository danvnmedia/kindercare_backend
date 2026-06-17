import { MealMenu, MealMenuConfig } from "@/domain/meal-menu";

const monday = new Date("2026-06-01T15:30:00.000Z");

describe("MealMenu Entity", () => {
  describe("create", () => {
    it("creates a whole-campus menu with default days and slots", () => {
      const menu = MealMenu.create({
        campusId: "campus-1",
        weekStartDate: monday,
      });

      expect(menu.targetType).toBe("campus");
      expect(menu.gradeLevelId).toBeNull();
      expect(menu.classId).toBeNull();
      expect(menu.targetIdentity).toEqual({
        targetType: "campus",
        gradeLevelId: null,
        classId: null,
      });
      expect(menu.weekStartDate.toISOString()).toBe("2026-06-01T00:00:00.000Z");
      expect(menu.days).toEqual([1, 2, 3, 4, 5]);
      expect(menu.mealSlots).toEqual(["Breakfast", "Lunch", "Afternoon"]);
      expect(menu.entries).toEqual([]);
      expect(menu.isArchived).toBe(false);
    });

    it("creates grade and class targets with explicit target identities", () => {
      const gradeMenu = MealMenu.create({
        campusId: "campus-1",
        targetType: "grade",
        gradeLevelId: "grade-1",
        gradeLevel: { id: "grade-1", name: "Kindergarten" },
        weekStartDate: monday,
      });
      const classMenu = MealMenu.create({
        campusId: "campus-1",
        targetType: "class",
        classId: "class-1",
        classroom: {
          id: "class-1",
          name: "Room 101",
          gradeLevelId: "grade-1",
        },
        weekStartDate: monday,
      });

      expect(gradeMenu.targetIdentity).toEqual({
        targetType: "grade",
        gradeLevelId: "grade-1",
        classId: null,
      });
      expect(classMenu.targetIdentity).toEqual({
        targetType: "class",
        gradeLevelId: null,
        classId: "class-1",
      });
      expect(classMenu.classroom).toEqual({
        id: "class-1",
        name: "Room 101",
        gradeLevelId: "grade-1",
      });
    });

    it("trims entry descriptions and omits blank entries", () => {
      const menu = MealMenu.create({
        campusId: "campus-1",
        weekStartDate: monday,
        entries: [
          { dayOfWeek: 1, slot: " Breakfast ", description: "  Oatmeal  " },
          { dayOfWeek: 2, slot: "Lunch", description: "   " },
        ],
      });

      expect(menu.entries).toEqual([
        { dayOfWeek: 1, slot: "Breakfast", description: "Oatmeal" },
      ]);
    });

    it("rejects non-Monday weekStartDate", () => {
      expect(() =>
        MealMenu.create({
          campusId: "campus-1",
          weekStartDate: new Date("2026-06-02T00:00:00.000Z"),
        }),
      ).toThrow("weekStartDate must be a Monday");
    });

    it("rejects invalid days and duplicate slots", () => {
      expect(() =>
        MealMenu.create({
          campusId: "campus-1",
          weekStartDate: monday,
          days: [1, 1],
        }),
      ).toThrow("days must not contain duplicate days");

      expect(() =>
        MealMenu.create({
          campusId: "campus-1",
          weekStartDate: monday,
          mealSlots: ["Lunch", " Lunch "],
        }),
      ).toThrow("mealSlots must not contain duplicate labels");
    });

    it("rejects entries outside the configured grid and duplicate cells", () => {
      expect(() =>
        MealMenu.create({
          campusId: "campus-1",
          weekStartDate: monday,
          days: [1],
          entries: [{ dayOfWeek: 2, slot: "Breakfast", description: "Toast" }],
        }),
      ).toThrow("Entry dayOfWeek must exist in menu days");

      expect(() =>
        MealMenu.create({
          campusId: "campus-1",
          weekStartDate: monday,
          entries: [
            { dayOfWeek: 1, slot: "Breakfast", description: "Toast" },
            { dayOfWeek: 1, slot: " Breakfast ", description: "Fruit" },
          ],
        }),
      ).toThrow("Duplicate meal-menu entry cell");
    });

    it("rejects mismatched grade-level snapshots", () => {
      expect(() =>
        MealMenu.create({
          campusId: "campus-1",
          gradeLevelId: "grade-1",
          gradeLevel: { id: "grade-2", name: "Toddler" },
          weekStartDate: monday,
        }),
      ).toThrow("Meal menu grade level snapshot must match gradeLevelId");
    });

    it("rejects invalid target identity combinations", () => {
      expect(() =>
        MealMenu.create({
          campusId: "campus-1",
          targetType: "campus",
          gradeLevelId: "grade-1",
          weekStartDate: monday,
        }),
      ).toThrow("Campus meal menus cannot include gradeLevelId or classId");

      expect(() =>
        MealMenu.create({
          campusId: "campus-1",
          targetType: "grade",
          weekStartDate: monday,
        }),
      ).toThrow("Grade meal menus require gradeLevelId");

      expect(() =>
        MealMenu.create({
          campusId: "campus-1",
          targetType: "class",
          classId: "class-1",
          gradeLevelId: "grade-1",
          weekStartDate: monday,
        }),
      ).toThrow("Class meal menus cannot include gradeLevelId");

      expect(() =>
        MealMenu.create({
          campusId: "campus-1",
          targetType: "class",
          classId: "class-1",
          classroom: {
            id: "class-2",
            name: "Room 102",
            gradeLevelId: "grade-1",
          },
          weekStartDate: monday,
        }),
      ).toThrow("Meal menu class snapshot must match classId");
    });
  });

  describe("domain methods", () => {
    it("updates metadata and replaces the grid with normalized entries", () => {
      const menu = MealMenu.create({
        campusId: "campus-1",
        weekStartDate: monday,
      });

      menu.update({
        title: "  New title  ",
        gradeLevelId: "grade-1",
        gradeLevel: { id: "grade-1", name: "Kindergarten" },
        days: [2, 3],
        mealSlots: [" Snack "],
        entries: [{ dayOfWeek: 2, slot: "Snack", description: "  Yogurt  " }],
      });

      expect(menu.title).toBe("New title");
      expect(menu.targetType).toBe("grade");
      expect(menu.targetIdentity).toEqual({
        targetType: "grade",
        gradeLevelId: "grade-1",
        classId: null,
      });
      expect(menu.gradeLevel).toEqual({ id: "grade-1", name: "Kindergarten" });
      expect(menu.days).toEqual([2, 3]);
      expect(menu.mealSlots).toEqual(["Snack"]);
      expect(menu.entries).toEqual([
        { dayOfWeek: 2, slot: "Snack", description: "Yogurt" },
      ]);
    });

    it("archives and restores the menu", () => {
      const menu = MealMenu.create({
        campusId: "campus-1",
        weekStartDate: monday,
      });

      menu.archive();
      expect(menu.isArchived).toBe(true);
      expect(() => menu.ensureActive()).toThrow(
        "Archived meal menus cannot be mutated",
      );

      menu.restore();
      expect(menu.isArchived).toBe(false);
      expect(() => menu.ensureActive()).not.toThrow();
    });
  });
});

describe("MealMenuConfig Entity", () => {
  it("creates config with virtual defaults", () => {
    const config = MealMenuConfig.create({ campusId: "campus-1" });

    expect(config.operatingDays).toEqual([1, 2, 3, 4, 5]);
    expect(config.defaultMealSlots).toEqual([
      "Breakfast",
      "Lunch",
      "Afternoon",
    ]);
  });

  it("validates and trims config updates", () => {
    const config = MealMenuConfig.create({ campusId: "campus-1" });

    config.update({
      operatingDays: [1, 6],
      defaultMealSlots: [" Breakfast ", "Snack"],
    });

    expect(config.operatingDays).toEqual([1, 6]);
    expect(config.defaultMealSlots).toEqual(["Breakfast", "Snack"]);

    expect(() => config.update({ operatingDays: [] })).toThrow(
      "operatingDays must be a non-empty array",
    );
  });
});
