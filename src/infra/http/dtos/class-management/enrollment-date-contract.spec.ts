import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { BulkEnrollStudentsRequest } from "./bulk-enroll-students.request";
import { BulkTransferStudentsRequest } from "./bulk-transfer-students.request";
import { EnrollStudentRequest } from "./enroll-student.request";
import { EnrollmentResponse } from "./enrollment.response";
import { RegisterForSchoolYearRequest } from "./register-for-school-year.request";
import { TransferStudentRequest } from "./transfer-student.request";
import { WithdrawFromSchoolRequest } from "./withdraw-from-school.request";
import { WithdrawStudentRequest } from "./withdraw-student.request";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";

async function expectValid(dto: object): Promise<void> {
  await expect(validate(dto)).resolves.toHaveLength(0);
}

async function expectInvalid(dto: object): Promise<void> {
  const errors = await validate(dto);
  expect(errors.length).toBeGreaterThan(0);
}

describe("enrollment date-only request contract", () => {
  const studentId = "11111111-1111-4111-a111-111111111111";
  const classId = "22222222-2222-4222-a222-222222222222";
  const schoolYearId = "33333333-3333-4333-a333-333333333333";
  const gradeLevelId = "44444444-4444-4444-a444-444444444444";

  it("accepts yyyy-MM-dd values on enrollment-related requests", async () => {
    await expectValid(
      plainToInstance(EnrollStudentRequest, {
        studentId,
        enrollmentDate: "2026-07-07",
      }),
    );
    await expectValid(
      plainToInstance(BulkEnrollStudentsRequest, {
        enrollmentDate: "2026-07-07",
        students: [{ studentId }],
      }),
    );
    await expectValid(
      plainToInstance(TransferStudentRequest, {
        toClassId: classId,
        transferDate: "2026-07-07",
      }),
    );
    await expectValid(
      plainToInstance(BulkTransferStudentsRequest, {
        transferDate: "2026-07-07",
        students: [{ studentId }],
      }),
    );
    await expectValid(
      plainToInstance(RegisterForSchoolYearRequest, {
        schoolYearId,
        gradeLevelId,
        enrollmentDate: "2026-07-07",
      }),
    );
    await expectValid(
      plainToInstance(WithdrawStudentRequest, {
        reason: ExitReason.WITHDRAWN,
        endDate: "2026-07-07",
      }),
    );
    await expectValid(
      plainToInstance(WithdrawFromSchoolRequest, {
        reason: ExitReason.WITHDRAWN,
        exitDate: "2026-07-07",
      }),
    );
  });

  it("rejects ISO datetime strings on enrollment-related requests", async () => {
    await expectInvalid(
      plainToInstance(EnrollStudentRequest, {
        studentId,
        enrollmentDate: "2026-07-07T10:30:00.000Z",
      }),
    );
    await expectInvalid(
      plainToInstance(BulkTransferStudentsRequest, {
        transferDate: "2026-07-07T10:30:00.000Z",
        students: [{ studentId }],
      }),
    );
    await expectInvalid(
      plainToInstance(RegisterForSchoolYearRequest, {
        schoolYearId,
        gradeLevelId,
        enrollmentDate: "2026-07-07T10:30:00.000Z",
      }),
    );
  });
});

describe("EnrollmentResponse clean contract", () => {
  it("exposes enrollmentDate and does not expose startDate", () => {
    const response = plainToInstance(
      EnrollmentResponse,
      {
        id: "enrollment-1",
        classId: "class-1",
        studentId: "student-1",
        enrollmentDate: new Date("2026-07-07T00:00:00.000Z"),
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        endDate: null,
        exitReason: null,
        note: null,
        createdAt: new Date("2026-07-07T00:00:00.000Z"),
        updatedAt: new Date("2026-07-07T00:00:00.000Z"),
      },
      { excludeExtraneousValues: true },
    );

    expect(response.enrollmentDate).toEqual(
      new Date("2026-07-07T00:00:00.000Z"),
    );
    expect(response).not.toHaveProperty("startDate");
  });
});
