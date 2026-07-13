import {
  getPostCategoryTextLength,
  normalizePostCategoryFields,
} from "./post-category-validation";

describe("post category validation", () => {
  it("normalizes frontend-compatible category fields", () => {
    expect(
      normalizePostCategoryFields({
        name: "  Announcements  ",
        color: " #3b82f6 ",
        icon: "  📢  ",
      }),
    ).toEqual({
      name: "Announcements",
      color: "#3b82f6",
      icon: "📢",
    });
  });

  it("counts emoji and variation sequences like the frontend", () => {
    expect(getPostCategoryTextLength("📢")).toBe(1);
    expect(getPostCategoryTextLength("❤️")).toBe(1);
  });

  it("enforces frontend name and icon limits", () => {
    expect(() => normalizePostCategoryFields({ name: "a".repeat(61) })).toThrow(
      "Category name cannot exceed 60 characters",
    );
    expect(() => normalizePostCategoryFields({ icon: "a".repeat(17) })).toThrow(
      "Category icon cannot exceed 16 characters",
    );
  });

  it("enforces the frontend hex color format", () => {
    expect(() => normalizePostCategoryFields({ color: "#fff" })).toThrow(
      "Color must be a valid hex color",
    );
  });
});
