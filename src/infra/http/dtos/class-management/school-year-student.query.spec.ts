import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { GetSchoolYearStudentsQuery } from "./school-year-student.query";

describe("GetSchoolYearStudentsQuery", () => {
  const instance = (payload: Record<string, unknown>) =>
    plainToInstance(GetSchoolYearStudentsQuery, payload, {
      enableImplicitConversion: true,
    });

  const validateStrict = (dto: GetSchoolYearStudentsQuery) =>
    validate(dto, { whitelist: true, forbidNonWhitelisted: true });

  it("accepts standard pagination and sort params with segment and search", async () => {
    const dto = instance({
      segment: "registered",
      search: "Linh",
      limit: "10",
      offset: "0",
      sort: "-enrollmentDate",
    });

    const errors = await validateStrict(dto);

    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(10);
    expect(dto.offset).toBe(0);
    expect(dto.sort).toBe("-enrollmentDate");
    expect(dto.segment).toBe("registered");
    expect(dto.search).toBe("Linh");
  });

  it("accepts the standard filter param", async () => {
    const dto = instance({
      filter: JSON.stringify({ exitReason: { in: ["COMPLETED"] } }),
    });

    const errors = await validateStrict(dto);

    expect(errors).toHaveLength(0);
    expect(dto.filter).toBe('{"exitReason":{"in":["COMPLETED"]}}');
  });

  it("accepts the upcoming segment", async () => {
    const dto = instance({ segment: "upcoming" });

    await expect(validateStrict(dto)).resolves.toHaveLength(0);
    expect(dto.segment).toBe("upcoming");
  });

  it("rejects unknown query params under production whitelist settings", async () => {
    const dto = instance({
      segment: "active",
      limit: "10",
      includeStatuses: "ACTIVE,WAITING",
    });

    const errors = await validateStrict(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === "includeStatuses")).toBe(
      true,
    );
  });

  it("rejects unsupported segment values", async () => {
    const dto = instance({ segment: "archived" });

    const errors = await validateStrict(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === "segment")).toBe(true);
  });
});
