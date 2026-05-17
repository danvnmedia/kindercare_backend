import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { EligibleStudentsQuery } from "./eligible-students.query";

describe("EligibleStudentsQuery", () => {
  const instance = (payload: Record<string, unknown>) =>
    plainToInstance(EligibleStudentsQuery, payload, {
      enableImplicitConversion: false,
    });

  describe("search", () => {
    it("accepts a non-empty string", async () => {
      const dto = instance({ search: "Anh" });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.search).toBe("Anh");
    });

    it("accepts an omitted value", async () => {
      const dto = instance({});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.search).toBeUndefined();
    });

    it("rejects a non-string value", async () => {
      const dto = instance({ search: 42 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe("search");
    });
  });

  describe("unknown query params (D9 hard-reject — Spec FR-9)", () => {
    // Matches the global ValidationPipe in src/main.ts which is configured with
    // `whitelist: true` + `forbidNonWhitelisted: true`. Any client that still
    // sends `includeStatuses` after the D9 cutover gets a 400.
    const validateStrict = (dto: EligibleStudentsQuery) =>
      validate(dto, { whitelist: true, forbidNonWhitelisted: true });

    it("rejects includeStatuses with a whitelist error", async () => {
      const dto = instance({ includeStatuses: "ACTIVE,WAITING" });
      const errors = await validateStrict(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === "includeStatuses")).toBe(true);
    });

    it("rejects any unknown query parameter", async () => {
      const dto = instance({ totallyMadeUpFilter: "yes" });
      const errors = await validateStrict(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === "totallyMadeUpFilter")).toBe(
        true,
      );
    });

    it("accepts a fully-allowed payload (search only)", async () => {
      const dto = instance({ search: "Anh" });
      const errors = await validateStrict(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
