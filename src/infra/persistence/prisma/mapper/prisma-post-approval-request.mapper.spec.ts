import { ApprovalStatus } from "@/domain/content-management";

import {
  PrismaPostApprovalRequestMapper,
  PrismaPostApprovalRequestWithRelations,
} from "./prisma-post-approval-request.mapper";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const OTHER_CAMPUS_ID = "99999999-9999-4999-a999-999999999999";
const POST_ID = "22222222-2222-4222-a222-222222222222";
const REQUEST_ID = "33333333-3333-4333-a333-333333333333";
const SUBMITTER_ID = "44444444-4444-4444-a444-444444444444";
const REVIEWER_ID = "55555555-5555-4555-a555-555555555555";
const NOW = new Date("2026-07-01T08:00:00.000Z");

describe("PrismaPostApprovalRequestMapper", () => {
  it("maps submitter and reviewer names from their post-campus profiles", () => {
    const request = PrismaPostApprovalRequestMapper.toDomain(
      approvalRequestRow({
        submittedBy: userRow(SUBMITTER_ID, {
          staffs: [
            { campusId: OTHER_CAMPUS_ID, fullName: "Wrong Campus" },
            { campusId: CAMPUS_ID, fullName: "Ada Lovelace" },
          ],
        }),
        reviewedBy: userRow(REVIEWER_ID, {
          guardians: [
            { campusId: CAMPUS_ID, fullName: "Grace Brewster Hopper" },
          ],
        }),
      }),
    );

    expect(request.toPlain()).toEqual(
      expect.objectContaining({
        submittedBy: {
          id: SUBMITTER_ID,
          firstName: "Ada",
          lastName: "Lovelace",
        },
        reviewedBy: {
          id: REVIEWER_ID,
          firstName: "Grace",
          lastName: "Brewster Hopper",
        },
      }),
    );
  });

  it("keeps an ID-only summary when no matching campus profile exists", () => {
    const request = PrismaPostApprovalRequestMapper.toDomain(
      approvalRequestRow({
        submittedBy: userRow(SUBMITTER_ID, {
          staffs: [{ campusId: OTHER_CAMPUS_ID, fullName: "Wrong Campus" }],
        }),
        reviewedBy: null,
        reviewedById: null,
        reviewedAt: null,
      }),
    );

    expect(request.toPlain()).toEqual(
      expect.objectContaining({
        submittedBy: { id: SUBMITTER_ID },
        reviewedBy: undefined,
      }),
    );
  });

  it("falls back to persisted user IDs when relations are not loaded", () => {
    const request = PrismaPostApprovalRequestMapper.toDomain(
      approvalRequestRow({
        post: undefined,
        submittedBy: undefined,
        reviewedBy: undefined,
      }),
    );

    expect(request.toPlain()).toEqual(
      expect.objectContaining({
        submittedBy: { id: SUBMITTER_ID },
        reviewedBy: { id: REVIEWER_ID },
      }),
    );
  });
});

function approvalRequestRow(
  overrides: Partial<PrismaPostApprovalRequestWithRelations> = {},
): PrismaPostApprovalRequestWithRelations {
  return {
    id: REQUEST_ID,
    postId: POST_ID,
    submittedById: SUBMITTER_ID,
    submittedAt: NOW,
    status: ApprovalStatus.APPROVED,
    reviewedById: REVIEWER_ID,
    reviewedAt: NOW,
    reviewNote: "Approved",
    titleSnapshot: "Weekly update",
    contentSnapshot: { type: "doc" },
    createdAt: NOW,
    post: { campusId: CAMPUS_ID },
    submittedBy: userRow(SUBMITTER_ID),
    reviewedBy: userRow(REVIEWER_ID),
    ...overrides,
  } as PrismaPostApprovalRequestWithRelations;
}

function userRow(
  id: string,
  overrides: Partial<
    NonNullable<PrismaPostApprovalRequestWithRelations["submittedBy"]>
  > = {},
): NonNullable<PrismaPostApprovalRequestWithRelations["submittedBy"]> {
  return {
    id,
    clerkUid: `clerk_${id}`,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    staffs: [],
    guardians: [],
    ...overrides,
  };
}
