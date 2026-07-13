import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { EnrollmentEffectiveStatusFilter } from "@/application/class-management/enrollment-effective-status-filter";

import { GetClassEnrollmentsQuery } from "./get-class-enrollments.query";

describe("GetClassEnrollmentsQuery", () => {
  const validateQuery = (payload: Record<string, unknown>) =>
    validate(plainToInstance(GetClassEnrollmentsQuery, payload), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

  it.each(Object.values(EnrollmentEffectiveStatusFilter))(
    "accepts effectiveStatus=%s",
    async (effectiveStatus) => {
      await expect(validateQuery({ effectiveStatus })).resolves.toHaveLength(0);
    },
  );

  it("accepts omission and rejects invalid status or removed includeHistorical", async () => {
    await expect(validateQuery({})).resolves.toHaveLength(0);
    await expect(
      validateQuery({ effectiveStatus: "INVALID" }),
    ).resolves.not.toHaveLength(0);
    await expect(
      validateQuery({ includeHistorical: true }),
    ).resolves.not.toHaveLength(0);
  });
});
