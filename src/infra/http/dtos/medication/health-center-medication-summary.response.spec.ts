import { instanceToPlain, plainToInstance } from "class-transformer";

import { HealthCenterMedicationSummaryResponseDto } from "./health-center-medication-summary.response";

describe("HealthCenterMedicationSummaryResponseDto", () => {
  it("exposes only medication summary counts and links", () => {
    const response = plainToInstance(
      HealthCenterMedicationSummaryResponseDto,
      {
        medication: {
          pendingRequests: 3,
          dueToday: 8,
          overdue: 2,
          needsMoreInfo: 1,
          links: {
            requests: "/health-center/medication-requests",
            administration: "/health-center/medication-administration",
            hiddenLink: "/internal",
          },
          hiddenCount: 99,
          attachmentDownloadUrl: "https://example.com/download",
          uploadUrl: "https://example.com/upload",
        },
        hiddenField: "must not leak",
        attachments: [{ id: "must-not-leak" }],
      },
      { excludeExtraneousValues: true },
    );

    const plain = instanceToPlain(response);

    expect(plain).toEqual({
      medication: {
        pendingRequests: 3,
        dueToday: 8,
        overdue: 2,
        needsMoreInfo: 1,
        links: {
          requests: "/health-center/medication-requests",
          administration: "/health-center/medication-administration",
        },
      },
    });
  });
});
