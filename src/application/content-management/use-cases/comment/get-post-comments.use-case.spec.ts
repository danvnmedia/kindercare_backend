import { Logger } from "@nestjs/common";

import { PostCommentRepository } from "@/application/content-management/ports/post-comment.repository";
import { PostRepository } from "@/application/content-management/ports/post.repository";
import { Post } from "@/domain/content-management";
import { createUser, DEFAULT_CAMPUS_ID_A } from "@/test-utils";
import { GetPostCommentsUseCase } from "./get-post-comments.use-case";

const USER_ID = "33333333-3333-4333-a333-333333333333";
const POST_ID = "44444444-4444-4444-a444-444444444444";

describe("GetPostCommentsUseCase", () => {
  const user = createUser({ id: USER_ID });
  let postRepository: jest.Mocked<PostRepository>;
  let commentRepository: jest.Mocked<PostCommentRepository>;
  let useCase: GetPostCommentsUseCase;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    postRepository = {
      findVisibleById: jest.fn().mockResolvedValue(
        Post.create(
          {
            campusId: DEFAULT_CAMPUS_ID_A,
            authorId: USER_ID,
            title: "Post",
          },
          POST_ID,
        ),
      ),
    } as unknown as jest.Mocked<PostRepository>;
    commentRepository = {
      findRootCommentsByPostId: jest.fn().mockResolvedValue({
        data: [],
        pagination: {
          count: 0,
          limit: 10,
          offset: 0,
          totalPages: 0,
          currentPage: 1,
          hasNext: false,
          hasPrev: false,
        },
      }),
      countByPost: jest.fn().mockResolvedValue(8),
      countPublicByPost: jest.fn().mockResolvedValue(5),
      countActivePublicByPost: jest.fn().mockResolvedValue(3),
    } as unknown as jest.Mocked<PostCommentRepository>;
    useCase = new GetPostCommentsUseCase(postRepository, commentRepository);
  });

  afterEach(() => jest.restoreAllMocks());

  it("reports only PUBLIC totals while retaining deleted PUBLIC comments", async () => {
    const result = await useCase.execute(
      POST_ID,
      DEFAULT_CAMPUS_ID_A,
      user,
      {},
    );

    expect(result).toMatchObject({ totalCount: 5, activeCount: 3 });
    expect(commentRepository.countPublicByPost).toHaveBeenCalledWith(POST_ID);
    expect(commentRepository.countActivePublicByPost).toHaveBeenCalledWith(
      POST_ID,
    );
    expect(commentRepository.countByPost).not.toHaveBeenCalled();
  });
});
