import { DECORATORS } from "@nestjs/swagger";

import { CreateStudentRequest } from "./create-student.request";

describe("CreateStudentRequest", () => {
  it("documents createUserAccount as an unsupported deprecated flag", () => {
    const metadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      CreateStudentRequest.prototype,
      "createUserAccount",
    );

    expect(metadata).toEqual(
      expect.objectContaining({
        default: false,
        deprecated: true,
        description:
          "Deprecated unsupported flag. Student login accounts are not supported yet; passing true returns 400.",
        example: false,
      }),
    );
  });
});
