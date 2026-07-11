import { instanceToPlain, plainToInstance } from "class-transformer";
import { PostStatus } from "@/domain/content-management/enums/post-status.enum";
import { PostHistoryStatusResponse } from "./post-history.response";

const transformOptions = {
  excludeExtraneousValues: true,
  enableImplicitConversion: true,
  exposeUnsetFields: false,
};

describe("PostHistoryStatusResponse", () => {
  it("serializes the frontend status-history contract", () => {
    const response = plainToInstance(
      PostHistoryStatusResponse,
      {
        id: "history-1",
        postId: "post-1",
        changedById: "user-1",
        previousStatus: PostStatus.DRAFT,
        newStatus: PostStatus.PENDING_REVIEW,
        reason: null,
        createdAt: "2026-07-01T08:00:00.000Z",
        userId: "legacy-user-id",
        status: PostStatus.DRAFT,
        comment: "legacy comment",
      },
      transformOptions,
    );

    const wire = JSON.parse(JSON.stringify(instanceToPlain(response)));

    expect(wire).toEqual({
      id: "history-1",
      postId: "post-1",
      changedById: "user-1",
      previousStatus: PostStatus.DRAFT,
      newStatus: PostStatus.PENDING_REVIEW,
      reason: null,
      changedAt: "2026-07-01T08:00:00.000Z",
    });
  });
});
