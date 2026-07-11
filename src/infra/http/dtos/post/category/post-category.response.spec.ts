import { plainToInstance } from "class-transformer";
import { PostCategoryResponse } from "./post-category.response";

const transformOptions = {
  excludeExtraneousValues: true,
  enableImplicitConversion: true,
  exposeUnsetFields: false,
};

const serialize = (isArchived: boolean) =>
  JSON.parse(
    JSON.stringify(
      plainToInstance(
        PostCategoryResponse,
        {
          id: "11111111-1111-4111-a111-111111111111",
          campusId: "22222222-2222-4222-a222-222222222222",
          name: "Announcements",
          color: "#FF5733",
          icon: null,
          order: 1,
          isArchived,
          createdAt: "2026-07-01T08:00:00.000Z",
          updatedAt: "2026-07-01T09:00:00.000Z",
          internalOnly: "must not leak",
        },
        transformOptions,
      ),
    ),
  ) as Record<string, unknown>;

describe("PostCategoryResponse", () => {
  it.each([
    [false, true],
    [true, false],
  ])("serializes isActive for isArchived=%s", (isArchived, isActive) => {
    const response = serialize(isArchived);

    expect(response).toMatchObject({ isArchived, isActive });
    expect(response).not.toHaveProperty("internalOnly");
  });
});
