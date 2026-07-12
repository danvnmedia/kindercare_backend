import { ForbiddenException, Logger } from "@nestjs/common";

import { PostCommentRepository } from "@/application/content-management/ports/post-comment.repository";
import { PostRepository } from "@/application/content-management/ports/post.repository";
import { Post, PostComment, PostStatus } from "@/domain/content-management";
import {
  DEFAULT_CAMPUS_ID_A,
  createPermission,
  createRole,
  createRoleAssignment,
  createUser,
} from "@/test-utils";

import { DeletePostCommentUseCase } from "./delete-post-comment.use-case";

const POST_ID = "44444444-4444-4444-a444-444444444444";
const COMMENT_ID = "55555555-5555-4555-a555-555555555555";
const POST_AUTHOR_ID = "66666666-6666-4666-a666-666666666666";
const COMMENT_AUTHOR_ID = "77777777-7777-4777-a777-777777777777";
const MODERATOR_ID = "88888888-8888-4888-a888-888888888888";

function userWithPermission(permissionId: string) {
  return createUser({
    id: MODERATOR_ID,
    roleAssignments: [
      createRoleAssignment(
        createRole({
          permissions: [createPermission({ id: permissionId, module: "post" })],
        }),
        DEFAULT_CAMPUS_ID_A,
      ),
    ],
  });
}

describe("DeletePostCommentUseCase", () => {
  let postRepository: jest.Mocked<PostRepository>;
  let commentRepository: jest.Mocked<PostCommentRepository>;
  let useCase: DeletePostCommentUseCase;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    postRepository = {
      findVisibleById: jest.fn().mockResolvedValue(
        Post.create(
          {
            campusId: DEFAULT_CAMPUS_ID_A,
            authorId: POST_AUTHOR_ID,
            title: "Published post",
            status: PostStatus.PUBLISHED,
          },
          POST_ID,
        ),
      ),
    } as unknown as jest.Mocked<PostRepository>;
    commentRepository = {
      findById: jest.fn().mockImplementation(async () =>
        PostComment.create(
          {
            postId: POST_ID,
            userId: COMMENT_AUTHOR_ID,
            content: "Public comment",
          },
          COMMENT_ID,
        ),
      ),
      update: jest.fn().mockImplementation(async (comment) => comment),
    } as unknown as jest.Mocked<PostCommentRepository>;
    useCase = new DeletePostCommentUseCase(postRepository, commentRepository);
  });

  afterEach(() => jest.restoreAllMocks());

  it("lets post.manage moderate another user's public comment", async () => {
    await useCase.execute(
      COMMENT_ID,
      DEFAULT_CAMPUS_ID_A,
      userWithPermission("post.manage"),
    );

    expect(commentRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        isDeleted: true,
        deletedById: MODERATOR_ID,
      }),
    );
  });

  it("does not treat post.update as comment moderation authority", async () => {
    await expect(
      useCase.execute(
        COMMENT_ID,
        DEFAULT_CAMPUS_ID_A,
        userWithPermission("post.update"),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(commentRepository.update).not.toHaveBeenCalled();
  });
});
