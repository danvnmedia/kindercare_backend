import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { AudienceType } from "@/domain/content-management";
import { UpdatePostRequest } from "./update-post.request";

describe("UpdatePostRequest", () => {
  it("accepts an omitted audience replacement", async () => {
    const dto = plainToInstance(UpdatePostRequest, { title: "Updated" });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([null, []])(
    "rejects invalid audience replacement %p",
    async (audiences) => {
      const dto = plainToInstance(UpdatePostRequest, { audiences });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === "audiences")).toBe(true);
    },
  );

  it("accepts a non-empty audience replacement", async () => {
    const dto = plainToInstance(UpdatePostRequest, {
      audiences: [{ audienceType: AudienceType.ALL }],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
