import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ReorderPostCategoriesRequest } from "./reorder-post-categories.request";

const UUID_1 = "22222222-2222-4222-a222-222222222222";
const UUID_2 = "33333333-3333-4333-a333-333333333333";

describe("ReorderPostCategoriesRequest", () => {
  it("accepts unique UUID v4 category IDs", async () => {
    const dto = plainToInstance(ReorderPostCategoriesRequest, {
      ids: [UUID_1, UUID_2],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each<[string[]]>([
    [[]],
    [[UUID_1, UUID_1]],
    [["not-a-uuid"]],
    [["22222222-2222-1222-a222-222222222222"]],
  ])("rejects invalid reorder IDs: %j", async (ids) => {
    const errors = await validate(
      plainToInstance(ReorderPostCategoriesRequest, { ids }),
    );

    expect(errors).not.toHaveLength(0);
  });
});
