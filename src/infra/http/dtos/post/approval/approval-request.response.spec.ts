import { instanceToPlain, plainToInstance } from "class-transformer";
import { ApprovalStatus } from "@/domain/content-management/enums/approval-status.enum";
import { ApprovalRequestResponse } from "./approval-request.response";

describe("ApprovalRequestResponse", () => {
  it("serializes provided submitter and reviewer summaries", () => {
    const response = plainToInstance(
      ApprovalRequestResponse,
      {
        id: "11111111-1111-4111-a111-111111111111",
        postId: "22222222-2222-4222-a222-222222222222",
        status: ApprovalStatus.APPROVED,
        titleSnapshot: "Weekly update",
        contentSnapshot: null,
        submittedBy: {
          id: "33333333-3333-4333-a333-333333333333",
          firstName: "Ada",
          lastName: "Lovelace",
          internalOnly: "must not leak",
        },
        submittedAt: "2026-07-01T08:00:00.000Z",
        reviewedBy: {
          id: "44444444-4444-4444-a444-444444444444",
          firstName: "Grace",
          lastName: "Hopper",
          internalOnly: "must not leak",
        },
        reviewedAt: "2026-07-01T09:00:00.000Z",
        reviewNote: "Approved",
        createdAt: "2026-07-01T08:00:00.000Z",
        internalOnly: "must not leak",
      },
      {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
        exposeUnsetFields: false,
      },
    );

    expect(instanceToPlain(response)).toEqual({
      id: "11111111-1111-4111-a111-111111111111",
      postId: "22222222-2222-4222-a222-222222222222",
      status: ApprovalStatus.APPROVED,
      titleSnapshot: "Weekly update",
      contentSnapshot: null,
      submittedBy: {
        id: "33333333-3333-4333-a333-333333333333",
        firstName: "Ada",
        lastName: "Lovelace",
      },
      submittedAt: new Date("2026-07-01T08:00:00.000Z"),
      reviewedBy: {
        id: "44444444-4444-4444-a444-444444444444",
        firstName: "Grace",
        lastName: "Hopper",
      },
      reviewedAt: new Date("2026-07-01T09:00:00.000Z"),
      reviewNote: "Approved",
      createdAt: new Date("2026-07-01T08:00:00.000Z"),
    });
  });
});
