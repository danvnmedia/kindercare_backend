import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { EligibleStudentsQuery } from "./eligible-students.query";
import { StudentStatus } from "@/domain/user-management/enums/student-status.enum";

describe("EligibleStudentsQuery", () => {
  const instance = (payload: Record<string, unknown>) =>
    plainToInstance(EligibleStudentsQuery, payload, {
      enableImplicitConversion: false,
    });

  describe("includeStatuses (D6)", () => {
    it("accepts an omitted value (default fallback handled by use case)", async () => {
      const dto = instance({});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.includeStatuses).toBeUndefined();
    });

    it("parses CSV input into a typed array", async () => {
      const dto = instance({ includeStatuses: "ACTIVE,WAITING" });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.includeStatuses).toEqual([
        StudentStatus.ACTIVE,
        StudentStatus.WAITING,
      ]);
    });

    it("normalizes lowercase / mixed-case input", async () => {
      const dto = instance({ includeStatuses: "active, Waiting , trial" });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.includeStatuses).toEqual([
        StudentStatus.ACTIVE,
        StudentStatus.WAITING,
        StudentStatus.TRIAL,
      ]);
    });

    it("rejects DROPPED outright", async () => {
      const dto = instance({ includeStatuses: "DROPPED" });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe("includeStatuses");
    });

    it("rejects GRADUATED outright", async () => {
      const dto = instance({ includeStatuses: "GRADUATED" });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe("includeStatuses");
    });

    it("rejects any list containing a disallowed value", async () => {
      const dto = instance({ includeStatuses: "ACTIVE,GRADUATED" });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe("includeStatuses");
    });

    it("rejects unknown status tokens", async () => {
      const dto = instance({ includeStatuses: "NOT_A_STATUS" });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe("includeStatuses");
    });
  });

  describe("search", () => {
    it("accepts a non-empty string", async () => {
      const dto = instance({ search: "Anh" });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.search).toBe("Anh");
    });

    it("rejects a non-string value", async () => {
      const dto = instance({ search: 42 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe("search");
    });
  });
});
