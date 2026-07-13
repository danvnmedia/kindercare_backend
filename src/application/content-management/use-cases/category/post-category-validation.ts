const POST_CATEGORY_NAME_MAX_LENGTH = 60;
const POST_CATEGORY_ICON_MAX_LENGTH = 16;
const POST_CATEGORY_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export interface PostCategoryFieldsInput {
  name?: string;
  color?: string;
  icon?: string | null;
}

export function normalizePostCategoryFields<T extends PostCategoryFieldsInput>(
  input: T,
): T {
  const normalized = { ...input };

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) {
      throw new Error("Category name is required");
    }
    if (getPostCategoryTextLength(name) > POST_CATEGORY_NAME_MAX_LENGTH) {
      throw new Error(
        `Category name cannot exceed ${POST_CATEGORY_NAME_MAX_LENGTH} characters`,
      );
    }
    normalized.name = name;
  }

  if (input.color !== undefined) {
    const color = input.color.trim();
    if (!POST_CATEGORY_COLOR_PATTERN.test(color)) {
      throw new Error("Color must be a valid hex color (e.g., #FF5733)");
    }
    normalized.color = color;
  }

  if (input.icon !== undefined && input.icon !== null) {
    const icon = input.icon.trim();
    if (getPostCategoryTextLength(icon) > POST_CATEGORY_ICON_MAX_LENGTH) {
      throw new Error(
        `Category icon cannot exceed ${POST_CATEGORY_ICON_MAX_LENGTH} characters`,
      );
    }
    normalized.icon = icon || null;
  }

  return normalized;
}

export function getPostCategoryTextLength(value: string): number {
  const presentationSequences =
    value.match(/[^\uFE0F\uFE0E][\uFE0F\uFE0E]/g) ?? [];
  const surrogatePairs = value.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g) ?? [];
  return value.length - presentationSequences.length - surrogatePairs.length;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
