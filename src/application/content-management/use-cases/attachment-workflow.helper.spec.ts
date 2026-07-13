import { Post, PostStatus } from "@/domain/content-management";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  AttachmentFileIntegrityError,
  AttachmentMutationStateError,
  AttachmentOrderConflictError,
} from "../ports/attachment.repository";
import {
  assertAttachmentMutationAllowed,
  rethrowAttachmentMutationError,
} from "./attachment-workflow.helper";

const POST_ID = "44444444-4444-4444-a444-444444444444";
const FILE_ID = "55555555-5555-4555-a555-555555555555";
const ATTACHMENT_ID = "66666666-6666-4666-a666-666666666666";

function createPost(status: PostStatus): Post {
  return Post.create(
    {
      campusId: "11111111-1111-4111-a111-111111111111",
      authorId: "33333333-3333-4333-a333-333333333333",
      title: "Campus update",
      status,
    },
    POST_ID,
  );
}

describe("attachment workflow helper", () => {
  it.each([PostStatus.PENDING_REVIEW, PostStatus.ARCHIVED])(
    "rejects %s mutations",
    (status) => {
      expect(() => assertAttachmentMutationAllowed(createPost(status))).toThrow(
        BadRequestException,
      );
    },
  );

  it("maps transaction state errors to workflow responses", () => {
    try {
      rethrowAttachmentMutationError(
        new AttachmentMutationStateError(PostStatus.PENDING_REVIEW),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({
          currentStatus: PostStatus.PENDING_REVIEW,
          requiredStatus: PostStatus.DRAFT,
        }),
      );
    }
  });

  it.each([
    ["NOT_FOUND", NotFoundException],
    ["NOT_OWNED", ForbiddenException],
    ["INVALID_PURPOSE", BadRequestException],
  ] as const)("maps %s file integrity errors", (reason, exceptionType) => {
    expect(() =>
      rethrowAttachmentMutationError(
        new AttachmentFileIntegrityError(FILE_ID, reason),
      ),
    ).toThrow(exceptionType);
  });

  it("preserves current orders for reorder conflicts", () => {
    const currentOrders = [{ id: ATTACHMENT_ID, order: 0 }];

    try {
      rethrowAttachmentMutationError(
        new AttachmentOrderConflictError(currentOrders),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual(
        expect.objectContaining({ currentOrders }),
      );
    }
  });
});
