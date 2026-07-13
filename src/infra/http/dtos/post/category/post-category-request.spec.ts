import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreatePostCategoryRequest } from "./create-post-category.request";
import { UpdatePostCategoryRequest } from "./update-post-category.request";

const VALID_COLOR = "#FF5733";

describe("post category request contracts", () => {
  it.each([
    ["name", { name: "a".repeat(61), color: VALID_COLOR }],
    [
      "icon",
      { name: "Announcements", color: VALID_COLOR, icon: "a".repeat(17) },
    ],
    ["order", { name: "Announcements", color: VALID_COLOR, order: 0 }],
  ])("rejects create %s outside the API contract", async (_field, input) => {
    const errors = await validate(
      plainToInstance(CreatePostCategoryRequest, input),
    );

    expect(errors).not.toHaveLength(0);
  });

  it.each([
    ["name", { name: "a".repeat(61) }],
    ["icon", { icon: "a".repeat(17) }],
    ["order", { order: 0 }],
  ])("rejects update %s outside the API contract", async (_field, input) => {
    const errors = await validate(
      plainToInstance(UpdatePostCategoryRequest, input),
    );

    expect(errors).not.toHaveLength(0);
  });

  it("accepts the documented category boundaries", async () => {
    const createErrors = await validate(
      plainToInstance(CreatePostCategoryRequest, {
        name: "a".repeat(60),
        color: VALID_COLOR,
        icon: "a".repeat(16),
        order: 1,
      }),
    );
    const updateErrors = await validate(
      plainToInstance(UpdatePostCategoryRequest, {
        name: "a".repeat(60),
        icon: "a".repeat(16),
        order: 1,
      }),
    );

    expect(createErrors).toHaveLength(0);
    expect(updateErrors).toHaveLength(0);
  });
});
