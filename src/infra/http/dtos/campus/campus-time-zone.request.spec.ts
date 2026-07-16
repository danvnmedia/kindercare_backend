import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateCampusRequest } from "./create-campus.request";
import { UpdateCampusRequest } from "./update-campus.request";

describe("Campus timezone request contract", () => {
  it("requires a valid IANA timezone when creating a campus", async () => {
    const missing = await validate(
      plainToInstance(CreateCampusRequest, { name: "Main Campus" }),
    );
    const invalid = await validate(
      plainToInstance(CreateCampusRequest, {
        name: "Main Campus",
        timeZone: "Mars/Olympus",
      }),
    );
    const valid = await validate(
      plainToInstance(CreateCampusRequest, {
        name: "Main Campus",
        timeZone: "Asia/Ho_Chi_Minh",
      }),
    );

    expect(missing.some((error) => error.property === "timeZone")).toBe(true);
    expect(invalid.some((error) => error.property === "timeZone")).toBe(true);
    expect(valid).toHaveLength(0);
  });

  it("accepts omission or a valid IANA timezone when updating", async () => {
    const omitted = await validate(plainToInstance(UpdateCampusRequest, {}));
    const valid = await validate(
      plainToInstance(UpdateCampusRequest, {
        timeZone: "America/Toronto",
      }),
    );

    expect(omitted).toHaveLength(0);
    expect(valid).toHaveLength(0);
  });
});
