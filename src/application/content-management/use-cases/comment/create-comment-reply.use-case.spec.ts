import { Logger, NotFoundException } from "@nestjs/common";

import { CampusSettingRepository } from "@/application/content-management/ports/campus-setting.repository";
import { PostCommentRepository } from "@/application/content-management/ports/post-comment.repository";
import { PostRepository } from "@/application/content-management/ports/post.repository";
import { PostComment } from "@/domain/content-management";
import { PostCommentType } from "@/domain/content-management/entities/post-comment.entity";
import { createUser, DEFAULT_CAMPUS_ID_A } from "@/test-utils";
import { CreateCommentReplyUseCase } from "./create-comment-reply.use-case";

const USER_ID = "33333333-3333-4333-a333-333333333333";
const POST_ID = "44444444-4444-4444-a444-444444444444";
const COMMENT_ID = "55555555-5555-4555-a555-555555555555";

describe("CreateCommentReplyUseCase", () => {
  const user = createUser({ id: USER_ID });
  let commentRepository: jest.Mocked<PostCommentRepository>;
  let postRepository: jest.Mocked<PostRepository>;
  let campusSettingRepository: jest.Mocked<CampusSettingRepository>;
  let useCase: CreateCommentReplyUseCase;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();

    commentRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<PostCommentRepository>;
    postRepository = {
      findVisibleById: jest.fn(),
    } as unknown as jest.Mocked<PostRepository>;
    campusSettingRepository = {
      findByCampusId: jest.fn(),
    } as unknown as jest.Mocked<CampusSettingRepository>;
    useCase = new CreateCommentReplyUseCase(
      commentRepository,
      postRepository,
      campusSettingRepository,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it("rejects a management parent before resolving or saving a public reply", async () => {
    commentRepository.findById.mockResolvedValue(
      PostComment.create(
        {
          postId: POST_ID,
          userId: USER_ID,
          content: "Internal note",
          commentType: PostCommentType.MANAGEMENT,
        },
        COMMENT_ID,
      ),
    );

    await expect(
      useCase.execute(
        {
          parentCommentId: COMMENT_ID,
          campusId: DEFAULT_CAMPUS_ID_A,
          content: "Public reply",
        },
        user,
      ),
    ).rejects.toThrow(
      new NotFoundException(`Comment with ID ${COMMENT_ID} not found`),
    );

    expect(postRepository.findVisibleById).not.toHaveBeenCalled();
    expect(campusSettingRepository.findByCampusId).not.toHaveBeenCalled();
    expect(commentRepository.save).not.toHaveBeenCalled();
  });
});
