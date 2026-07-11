import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { ApprovalStatus, PostStatus } from "@/domain/content-management";

import { PrismaPostApprovalRequestMapper } from "../mapper/prisma-post-approval-request.mapper";
import { PrismaService } from "../prisma.service";
import { PrismaPostApprovalRequestRepository } from "./prisma-post-approval-request.repository";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const CURRENT_REQUEST_ID = "22222222-2222-4222-a222-222222222222";
const STALE_REQUEST_ID = "33333333-3333-4333-a333-333333333333";

describe("PrismaPostApprovalRequestRepository", () => {
  let postDelegate: { findMany: jest.Mock };
  let approvalRequestDelegate: { count: jest.Mock };
  let queryService: jest.Mocked<PrismaQueryService>;
  let repository: PrismaPostApprovalRequestRepository;

  beforeEach(() => {
    postDelegate = { findMany: jest.fn() };
    approvalRequestDelegate = { count: jest.fn() };
    queryService = {
      executeQuery: jest.fn().mockResolvedValue({
        data: [],
        pagination: { count: 0 },
      }),
    } as unknown as jest.Mocked<PrismaQueryService>;
    repository = new PrismaPostApprovalRequestRepository(
      {
        post: postDelegate,
        postApprovalRequest: approvalRequestDelegate,
      } as unknown as PrismaService,
      queryService,
    );
  });

  it("queues only the latest pending request of active pending-review posts", async () => {
    postDelegate.findMany.mockResolvedValue([
      {
        approvalRequests: [
          { id: CURRENT_REQUEST_ID, status: ApprovalStatus.PENDING },
        ],
      },
      {
        approvalRequests: [
          { id: STALE_REQUEST_ID, status: ApprovalStatus.APPROVED },
        ],
      },
      { approvalRequests: [] },
    ]);
    const params = {};

    await repository.findPendingByCampus(CAMPUS_ID, params);

    expect(postDelegate.findMany).toHaveBeenCalledWith({
      where: {
        campusId: CAMPUS_ID,
        isDeleted: false,
        status: PostStatus.PENDING_REVIEW,
      },
      select: {
        approvalRequests: {
          orderBy: [
            { submittedAt: "desc" },
            { createdAt: "desc" },
            { id: "desc" },
          ],
          take: 1,
          select: { id: true, status: true },
        },
      },
    });
    expect(queryService.executeQuery).toHaveBeenCalledWith(
      expect.anything(),
      "postApprovalRequest",
      expect.objectContaining({
        allowedFilterFields: ["submittedById"],
        allowedSortFields: ["submittedAt", "createdAt"],
      }),
      expect.objectContaining({
        where: {
          id: { in: [CURRENT_REQUEST_ID] },
          status: ApprovalStatus.PENDING,
          post: {
            campusId: CAMPUS_ID,
            isDeleted: false,
            status: PostStatus.PENDING_REVIEW,
          },
        },
        include: PrismaPostApprovalRequestMapper.include,
      }),
      PrismaPostApprovalRequestMapper,
    );
  });

  it("uses the same current-request scope for pending counts", async () => {
    postDelegate.findMany.mockResolvedValue([
      {
        approvalRequests: [
          { id: CURRENT_REQUEST_ID, status: ApprovalStatus.PENDING },
        ],
      },
      {
        approvalRequests: [
          { id: STALE_REQUEST_ID, status: ApprovalStatus.REJECTED },
        ],
      },
    ]);
    approvalRequestDelegate.count.mockResolvedValue(1);

    await expect(repository.countPendingByCampus(CAMPUS_ID)).resolves.toBe(1);

    expect(approvalRequestDelegate.count).toHaveBeenCalledWith({
      where: {
        id: { in: [CURRENT_REQUEST_ID] },
        status: ApprovalStatus.PENDING,
        post: {
          campusId: CAMPUS_ID,
          isDeleted: false,
          status: PostStatus.PENDING_REVIEW,
        },
      },
    });
  });

  it("hydrates approval detail with submitter and reviewer profiles", async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    repository = new PrismaPostApprovalRequestRepository(
      {
        postApprovalRequest: { findUnique },
      } as unknown as PrismaService,
      queryService,
    );

    await repository.findById(CURRENT_REQUEST_ID);

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: CURRENT_REQUEST_ID },
      include: PrismaPostApprovalRequestMapper.include,
    });
  });

  it("hydrates approval history with submitter and reviewer profiles", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    repository = new PrismaPostApprovalRequestRepository(
      {
        postApprovalRequest: { findMany },
      } as unknown as PrismaService,
      queryService,
    );

    await repository.findByPostId("post-1");

    expect(findMany).toHaveBeenCalledWith({
      where: { postId: "post-1" },
      include: PrismaPostApprovalRequestMapper.include,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
  });

  it("routes PENDING status lists through the stale-safe queue scope", async () => {
    postDelegate.findMany.mockResolvedValue([]);
    const params = {};

    await repository.findByCampusAndStatus(
      CAMPUS_ID,
      ApprovalStatus.PENDING,
      params,
    );

    expect(queryService.executeQuery).toHaveBeenCalledWith(
      expect.anything(),
      "postApprovalRequest",
      params,
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [] },
          status: ApprovalStatus.PENDING,
        }),
      }),
      PrismaPostApprovalRequestMapper,
    );
  });
});
