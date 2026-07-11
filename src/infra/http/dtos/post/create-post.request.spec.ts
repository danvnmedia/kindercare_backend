import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { AudienceType } from "@/domain/content-management";
import { CreatePostRequest } from "./create-post.request";

const validPayload = {
  clientMutationId: "8c05d3f1-7430-42b8-b6cf-9c235af23e15",
  title: "Campus update",
  audiences: [{ audienceType: AudienceType.ALL }],
};

describe("CreatePostRequest", () => {
  it("accepts a UUID clientMutationId", async () => {
    const dto = plainToInstance(CreatePostRequest, validPayload);

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([undefined, "retry-1"])(
    "rejects invalid clientMutationId %p",
    async (clientMutationId) => {
      const dto = plainToInstance(CreatePostRequest, {
        ...validPayload,
        clientMutationId,
      });

      const errors = await validate(dto);

      expect(
        errors.some((error) => error.property === "clientMutationId"),
      ).toBe(true);
    },
  );
});
