import "reflect-metadata";
import { HttpStatus, RequestMethod } from "@nestjs/common";
import { HTTP_CODE_METADATA, METHOD_METADATA } from "@nestjs/common/constants";
import { DECORATORS } from "@nestjs/swagger/dist/constants";

import { FileController } from "./file.controller";

function handler(name: keyof FileController) {
  return FileController.prototype[name];
}

describe("FileController response metadata", () => {
  it.each(["initiateUpload", "completeUpload"] as Array<keyof FileController>)(
    "%s documents Nest's default POST 201 status",
    (methodName) => {
      const route = handler(methodName);
      const responses = Reflect.getMetadata(
        DECORATORS.API_RESPONSE,
        route,
      ) as Record<string, unknown>;

      expect(Reflect.getMetadata(METHOD_METADATA, route)).toBe(
        RequestMethod.POST,
      );
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, route)).toBe(
        HttpStatus.CREATED,
      );
      expect(responses).toHaveProperty(String(HttpStatus.CREATED));
      expect(responses).not.toHaveProperty(String(HttpStatus.OK));
    },
  );
});
