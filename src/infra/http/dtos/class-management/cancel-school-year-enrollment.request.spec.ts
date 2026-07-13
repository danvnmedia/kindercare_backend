import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";

import { CancelSchoolYearEnrollmentRequest } from "./cancel-school-year-enrollment.request";

describe("CancelSchoolYearEnrollmentRequest", () => {
  const validateRequest = (payload: Record<string, unknown>) =>
    validate(plainToInstance(CancelSchoolYearEnrollmentRequest, payload), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

  it("accepts every cancellation reason and trims an optional note", async () => {
    for (const cancellationReason of Object.values(
      EnrollmentCancellationReason,
    )) {
      const request = plainToInstance(CancelSchoolYearEnrollmentRequest, {
        cancellationReason,
        note: "  family plans changed  ",
      });

      await expect(
        validate(request, { whitelist: true, forbidNonWhitelisted: true }),
      ).resolves.toHaveLength(0);
      expect(request.note).toBe("family plans changed");
    }
  });

  it("rejects missing/invalid reasons, null/non-string notes, oversized notes, and unknown fields", async () => {
    await expect(validateRequest({})).resolves.not.toHaveLength(0);
    await expect(
      validateRequest({ cancellationReason: "INVALID" }),
    ).resolves.not.toHaveLength(0);
    await expect(
      validateRequest({
        cancellationReason: EnrollmentCancellationReason.OTHER,
        note: null,
      }),
    ).resolves.not.toHaveLength(0);
    await expect(
      validateRequest({
        cancellationReason: EnrollmentCancellationReason.OTHER,
        note: 123,
      }),
    ).resolves.not.toHaveLength(0);
    await expect(
      validateRequest({
        cancellationReason: EnrollmentCancellationReason.OTHER,
        note: "x".repeat(501),
      }),
    ).resolves.not.toHaveLength(0);
    await expect(
      validateRequest({
        cancellationReason: EnrollmentCancellationReason.OTHER,
        exitDate: "2026-08-31",
      }),
    ).resolves.not.toHaveLength(0);
  });
});
