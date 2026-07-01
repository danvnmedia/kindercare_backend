import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { MedicationRequestStatus } from "@/domain/medication";

import {
  CancelMedicationRequestRequest,
  ListMedicationRequestsQuery,
  ListStaffMedicationRequestsQuery,
  RespondMedicationRequestRequest,
  ReviewMedicationRequestRequest,
} from "./index";

describe("parent medication request action DTOs", () => {
  it("accepts valid parent list filters", async () => {
    const dto = plainToInstance(ListMedicationRequestsQuery, {
      studentId: "22222222-2222-4222-a222-222222222222",
      status: MedicationRequestStatus.SUBMITTED,
      fromDate: "2099-07-01",
      toDate: "2099-07-31",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("accepts valid staff list filters and review actions", async () => {
    const listDto = plainToInstance(ListStaffMedicationRequestsQuery, {
      status: MedicationRequestStatus.SUBMITTED,
      studentId: "22222222-2222-4222-a222-222222222222",
      classId: "99999999-9999-4999-a999-999999999999",
      fromDate: "2099-07-01",
      toDate: "2099-07-31",
      search: "Antibiotic",
    });
    await expect(validate(listDto)).resolves.toHaveLength(0);

    const reviewDto = plainToInstance(ReviewMedicationRequestRequest, {
      action: "APPROVE",
      note: "Approved for this week.",
    });
    await expect(validate(reviewDto)).resolves.toHaveLength(0);
  });

  it("rejects invalid parent list filters", async () => {
    const dto = plainToInstance(ListMedicationRequestsQuery, {
      studentId: "not-a-uuid",
      status: "PENDING",
      fromDate: "2099-02-31",
      toDate: "07/31/2099",
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual([
      "studentId",
      "status",
      "fromDate",
      "toDate",
    ]);
  });

  it("rejects invalid staff list filters and review actions", async () => {
    const listDto = plainToInstance(ListStaffMedicationRequestsQuery, {
      status: "PENDING",
      studentId: "not-a-uuid",
      classId: "not-a-uuid",
      fromDate: "2099-02-31",
      toDate: "07/31/2099",
    });

    const listErrors = await validate(listDto);

    expect(listErrors.map((error) => error.property)).toEqual([
      "status",
      "studentId",
      "classId",
      "fromDate",
      "toDate",
    ]);

    const reviewDto = plainToInstance(ReviewMedicationRequestRequest, {
      action: "PENDING",
    });
    const reviewErrors = await validate(reviewDto);

    expect(reviewErrors).toHaveLength(1);
    expect(reviewErrors[0].property).toBe("action");
  });

  it("accepts optional cancel reason and requires response message", async () => {
    await expect(
      validate(plainToInstance(CancelMedicationRequestRequest, {})),
    ).resolves.toHaveLength(0);

    const validResponse = plainToInstance(RespondMedicationRequestRequest, {
      message: "Doctor confirmed the lunch dosage should be 5 ml.",
    });
    await expect(validate(validResponse)).resolves.toHaveLength(0);

    const invalidResponse = plainToInstance(RespondMedicationRequestRequest, {
      message: "",
    });
    const errors = await validate(invalidResponse);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("message");
  });
});
