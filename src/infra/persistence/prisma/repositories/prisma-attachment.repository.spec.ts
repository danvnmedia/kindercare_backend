import { Attachment, PostStatus } from "@/domain/content-management";
import { FilePurpose } from "@/domain/file-management/enums/file-purpose.enum";
import { FileStatus } from "@/domain/file-management/enums/file-status.enum";
import { PrismaService } from "../prisma.service";
import { PrismaAttachmentRepository } from "./prisma-attachment.repository";

const POST_ID = "44444444-4444-4444-a444-444444444444";
const AUTHOR_ID = "33333333-3333-4333-a333-333333333333";
const FILE_ID = "55555555-5555-4555-a555-555555555555";
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const ATTACHMENT_ID_A = "66666666-6666-4666-a666-666666666666";
const ATTACHMENT_ID_B = "77777777-7777-4777-a777-777777777777";
const context = {
  changedById: AUTHOR_ID,
  reason: "Attachments reordered",
};

describe("PrismaAttachmentRepository workflow integrity", () => {
  let tx: {
    $queryRaw: jest.Mock;
    post: { findFirst: jest.Mock; update: jest.Mock };
    postHistoryStatus: { create: jest.Mock };
    file: { findUnique: jest.Mock };
    attachment: {
      aggregate: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let repository: PrismaAttachmentRepository;

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: POST_ID }]),
      post: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: POST_ID }),
      },
      postHistoryStatus: {
        create: jest.fn().mockResolvedValue({}),
      },
      file: {
        findUnique: jest.fn().mockResolvedValue({
          campusId: CAMPUS_ID,
          status: FileStatus.UPLOADED,
          purpose: FilePurpose.POST_ATTACHMENT,
          uploadedBy: AUTHOR_ID,
          isDeleted: false,
        }),
      },
      attachment: {
        aggregate: jest.fn().mockResolvedValue({ _max: { order: null } }),
        create: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn((work) => work(tx)),
    } as unknown as PrismaService;
    repository = new PrismaAttachmentRepository(prisma);
  });

  it("demotes and unpins a published post in the attachment transaction", async () => {
    tx.post.findFirst.mockResolvedValue({
      status: PostStatus.PUBLISHED,
      campusId: CAMPUS_ID,
    });
    tx.attachment.findMany.mockResolvedValue([
      { id: ATTACHMENT_ID_A, order: 0 },
      { id: ATTACHMENT_ID_B, order: 1 },
    ]);

    await repository.updateOrder(
      POST_ID,
      [
        { id: ATTACHMENT_ID_B, order: 0 },
        { id: ATTACHMENT_ID_A, order: 1 },
      ],
      context,
    );

    expect(tx.post.update).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: {
        status: PostStatus.DRAFT,
        publishAt: null,
        isPinned: false,
        pinnedById: null,
        pinnedUntil: null,
      },
    });
    expect(tx.postHistoryStatus.create).toHaveBeenCalledWith({
      data: {
        postId: POST_ID,
        changedById: AUTHOR_ID,
        previousStatus: PostStatus.PUBLISHED,
        newStatus: PostStatus.DRAFT,
        reason: "Attachments reordered; published post requires resubmission",
      },
    });
    expect(tx.post.update.mock.invocationCallOrder[0]).toBeLessThan(
      tx.attachment.updateMany.mock.invocationCallOrder[0],
    );
  });

  it.each([PostStatus.PENDING_REVIEW, PostStatus.ARCHIVED])(
    "rejects %s state under the post lock",
    async (status) => {
      tx.post.findFirst.mockResolvedValue({ status, campusId: CAMPUS_ID });

      await expect(
        repository.updateOrder(
          POST_ID,
          [{ id: ATTACHMENT_ID_A, order: 0 }],
          context,
        ),
      ).rejects.toMatchObject({ currentStatus: status });

      expect(tx.post.update).not.toHaveBeenCalled();
      expect(tx.postHistoryStatus.create).not.toHaveBeenCalled();
      expect(tx.attachment.findMany).not.toHaveBeenCalled();
      expect(tx.attachment.updateMany).not.toHaveBeenCalled();
    },
  );

  it("treats the full current attachment set as authoritative", async () => {
    const currentOrders = [
      { id: ATTACHMENT_ID_A, order: 0 },
      { id: ATTACHMENT_ID_B, order: 1 },
    ];
    tx.post.findFirst.mockResolvedValue({
      status: PostStatus.DRAFT,
      campusId: CAMPUS_ID,
    });
    tx.attachment.findMany.mockResolvedValue(currentOrders);

    await expect(
      repository.updateOrder(
        POST_ID,
        [{ id: ATTACHMENT_ID_A, order: 0 }],
        context,
      ),
    ).rejects.toMatchObject({ currentOrders });

    expect(tx.attachment.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["CAMPUS_MISMATCH", { campusId: "22222222-2222-4222-a222-222222222222" }],
    ["UNAVAILABLE", { status: FileStatus.PENDING }],
    ["INVALID_PURPOSE", { purpose: FilePurpose.PROFILE_PHOTO }],
    ["INVALID_PURPOSE", { purpose: FilePurpose.ATTENDANCE_IMAGE }],
    ["NOT_OWNED", { uploadedBy: "88888888-8888-4888-a888-888888888888" }],
  ])("rejects file integrity race: %s", async (reason, override) => {
    tx.post.findFirst.mockResolvedValue({
      status: PostStatus.DRAFT,
      campusId: CAMPUS_ID,
    });
    tx.file.findUnique.mockResolvedValue({
      campusId: CAMPUS_ID,
      status: FileStatus.UPLOADED,
      purpose: FilePurpose.POST_ATTACHMENT,
      uploadedBy: AUTHOR_ID,
      isDeleted: false,
      ...override,
    });

    await expect(
      repository.appendToPost(
        Attachment.create({ postId: POST_ID, fileId: FILE_ID, order: 0 }),
        context,
      ),
    ).rejects.toMatchObject({ reason });

    expect(tx.attachment.aggregate).not.toHaveBeenCalled();
    expect(tx.attachment.create).not.toHaveBeenCalled();
  });
});
