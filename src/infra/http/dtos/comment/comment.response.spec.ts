import { plainToInstance, instanceToPlain } from "class-transformer";

import { PostComment } from "@/domain/content-management";
import { createUser } from "@/test-utils";
import {
  CommentResponse,
  DELETED_COMMENT_CONTENT,
  GetCommentsResponse,
} from "./comment.response";

const USER_ID = "33333333-3333-4333-a333-333333333333";
const POST_ID = "44444444-4444-4444-a444-444444444444";

describe("comment response contracts", () => {
  it("retains hydrated comment authors through entity creation", () => {
    const user = createUser({ id: USER_ID });
    const comment = PostComment.create({
      postId: POST_ID,
      userId: USER_ID,
      user,
      content: "Hello",
    });

    expect(comment.user).toBe(user);
  });

  it("masks deleted mutation responses without changing persisted audit content", () => {
    const comment = PostComment.create({
      postId: POST_ID,
      userId: USER_ID,
      content: "Sensitive audit content",
    });
    comment.softDelete(USER_ID);

    const response = plainToInstance(CommentResponse, comment, {
      excludeExtraneousValues: true,
    });

    expect(instanceToPlain(response)).toMatchObject({
      content: DELETED_COMMENT_CONTENT,
      isDeleted: true,
    });
    expect(comment.content).toBe("Sensitive audit content");
  });

  it("masks deleted comments at every nested tree level", () => {
    const response = plainToInstance(
      GetCommentsResponse,
      {
        comments: [
          {
            comment: {
              id: "comment-1",
              postId: POST_ID,
              userId: USER_ID,
              parentCommentId: null,
              depth: 0,
              content: "Root audit content",
              isDeleted: true,
              createdAt: new Date("2026-07-11T00:00:00.000Z"),
              updatedAt: new Date("2026-07-11T00:00:00.000Z"),
            },
            replies: [
              {
                comment: {
                  id: "comment-2",
                  postId: POST_ID,
                  userId: USER_ID,
                  parentCommentId: "comment-1",
                  depth: 1,
                  content: "Reply audit content",
                  isDeleted: true,
                  createdAt: new Date("2026-07-11T00:00:00.000Z"),
                  updatedAt: new Date("2026-07-11T00:00:00.000Z"),
                },
                replies: [],
                replyCount: 0,
              },
            ],
            replyCount: 1,
          },
        ],
        pagination: {
          count: 1,
          limit: 10,
          offset: 0,
          totalPages: 1,
          currentPage: 1,
          hasNext: false,
          hasPrev: false,
        },
        totalCount: 2,
        activeCount: 0,
      },
      { excludeExtraneousValues: true },
    );

    const plain = instanceToPlain(response) as {
      comments: Array<{
        comment: { content: string };
        replies: Array<{ comment: { content: string } }>;
      }>;
    };

    expect(plain.comments[0].comment.content).toBe(DELETED_COMMENT_CONTENT);
    expect(plain.comments[0].replies[0].comment.content).toBe(
      DELETED_COMMENT_CONTENT,
    );
  });

  it("serializes root comment pagination and hydrated authors", () => {
    const response = plainToInstance(
      GetCommentsResponse,
      {
        comments: [
          {
            comment: {
              id: "comment-1",
              postId: POST_ID,
              userId: USER_ID,
              user: {
                id: USER_ID,
                name: "Teacher",
                email: "teacher@example.com",
                createdAt: new Date("2026-07-11T00:00:00.000Z"),
                updatedAt: new Date("2026-07-11T00:00:00.000Z"),
              },
              parentCommentId: null,
              depth: 0,
              content: "Hello",
              isDeleted: false,
              createdAt: new Date("2026-07-11T00:00:00.000Z"),
              updatedAt: new Date("2026-07-11T00:00:00.000Z"),
            },
            replies: [],
            replyCount: 0,
          },
        ],
        pagination: {
          count: 1,
          limit: 10,
          offset: 0,
          totalPages: 1,
          currentPage: 1,
          hasNext: false,
          hasPrev: false,
        },
        totalCount: 1,
        activeCount: 1,
      },
      { excludeExtraneousValues: true },
    );

    expect(instanceToPlain(response)).toMatchObject({
      comments: [{ comment: { user: { id: USER_ID } } }],
      pagination: { count: 1, limit: 10, offset: 0 },
      totalCount: 1,
      activeCount: 1,
    });
  });
});
