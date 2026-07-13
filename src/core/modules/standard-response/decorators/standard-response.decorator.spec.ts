import "reflect-metadata";
import { HttpStatus } from "@nestjs/common";
import { DECORATORS } from "@nestjs/swagger";

import { StandardResponse } from "./standard-response.decorator";

class TestController {
  @StandardResponse({ type: String, isPaginated: true })
  list() {}

  @StandardResponse({ type: String, status: HttpStatus.CREATED })
  create() {}
}

describe("StandardResponse", () => {
  it("documents the shared runtime pagination default", () => {
    const parameters = Reflect.getMetadata(
      DECORATORS.API_PARAMETERS,
      TestController.prototype.list,
    ) as Array<{ name: string; example?: number }>;

    expect(parameters.find(({ name }) => name === "limit")?.example).toBe(10);
  });

  it("documents an explicit runtime response status", () => {
    const responses = Reflect.getMetadata(
      DECORATORS.API_RESPONSE,
      TestController.prototype.create,
    ) as Record<string, unknown>;

    expect(responses).toHaveProperty(String(HttpStatus.CREATED));
    expect(responses).not.toHaveProperty(String(HttpStatus.OK));
  });
});
