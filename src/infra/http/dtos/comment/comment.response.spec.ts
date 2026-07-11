import { plainToInstance, instanceToPlain } from "class-transformer";

import { PostComment } from "@/domain/content-management";
import { createUser } from "@/test-utils";
import { GetCommentsResponse } from "./comment.response";

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
