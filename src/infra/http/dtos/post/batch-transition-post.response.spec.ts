import { instanceToPlain, plainToInstance } from "class-transformer";
import { AudienceType, PostStatus } from "@/domain/content-management/enums";
import { BatchTransitionPostResponse } from "./batch-transition-post.request";

const transformOptions = {
  excludeExtraneousValues: true,
  enableImplicitConversion: true,
  exposeUnsetFields: false,
};

describe("BatchTransitionPostResponse", () => {
  it("serializes nested success and error results", () => {
    const response = plainToInstance(
      BatchTransitionPostResponse,
      {
        total: 2,
        succeeded: 1,
        failed: 1,
        internalOnly: "must not leak",
        results: [
          {
            postId: "11111111-1111-4111-a111-111111111111",
            success: true,
            internalOnly: "must not leak",
            post: {
              id: "11111111-1111-4111-a111-111111111111",
              campusId: "22222222-2222-4222-a222-222222222222",
              title: "Weekly update",
              content: null,
              contentText: null,
              contentVersion: 2,
              status: PostStatus.PUBLISHED,
              isPinned: false,
              requiresApproval: true,
              author: {
                id: "33333333-3333-4333-a333-333333333333",
                profile: {
                  fullName: "Ada Lovelace",
                  email: "ada@example.com",
                },
                createdAt: "2026-07-01T08:00:00.000Z",
                updatedAt: "2026-07-01T09:00:00.000Z",
              },
              audiences: [
                {
                  id: "44444444-4444-4444-a444-444444444444",
                  type: AudienceType.CLASS,
                  postId: "11111111-1111-4111-a111-111111111111",
                  campusId: "22222222-2222-4222-a222-222222222222",
                  classId: "55555555-5555-4555-a555-555555555555",
                  class: {
                    id: "55555555-5555-4555-a555-555555555555",
                    name: "Sunflower",
                    internalOnly: "must not leak",
                  },
                },
              ],
              attachments: [],
              categories: [
                {
                  id: "66666666-6666-4666-a666-666666666666",
                  name: "Announcements",
                  color: "#FF5733",
                  icon: "megaphone",
                  internalOnly: "must not leak",
                },
              ],
              createdAt: "2026-07-01T08:00:00.000Z",
              updatedAt: "2026-07-01T09:00:00.000Z",
              internalOnly: "must not leak",
            },
          },
          {
            postId: "77777777-7777-4777-a777-777777777777",
            success: false,
            error: {
              code: "INVALID_TRANSITION",
              message: "Post cannot be published",
              statusCode: 409,
              internalOnly: "must not leak",
            },
          },
        ],
      },
      transformOptions,
    );

    expect(instanceToPlain(response)).toEqual({
      total: 2,
      succeeded: 1,
      failed: 1,
      results: [
        {
          postId: "11111111-1111-4111-a111-111111111111",
          success: true,
          post: {
            id: "11111111-1111-4111-a111-111111111111",
            campusId: "22222222-2222-4222-a222-222222222222",
            title: "Weekly update",
            content: null,
            contentText: null,
            contentVersion: 2,
            status: PostStatus.PUBLISHED,
            isPinned: false,
            requiresApproval: true,
            author: {
              id: "33333333-3333-4333-a333-333333333333",
              name: "Ada Lovelace",
              email: "ada@example.com",
              createdAt: new Date("2026-07-01T08:00:00.000Z"),
              updatedAt: new Date("2026-07-01T09:00:00.000Z"),
            },
            audiences: [
              {
                id: "44444444-4444-4444-a444-444444444444",
                type: AudienceType.CLASS,
                postId: "11111111-1111-4111-a111-111111111111",
                campusId: "22222222-2222-4222-a222-222222222222",
                classId: "55555555-5555-4555-a555-555555555555",
                class: {
                  id: "55555555-5555-4555-a555-555555555555",
                  name: "Sunflower",
                },
              },
            ],
            attachments: [],
            categories: [
              {
                id: "66666666-6666-4666-a666-666666666666",
                name: "Announcements",
                color: "#FF5733",
                icon: "megaphone",
              },
            ],
            createdAt: new Date("2026-07-01T08:00:00.000Z"),
            updatedAt: new Date("2026-07-01T09:00:00.000Z"),
          },
        },
        {
          postId: "77777777-7777-4777-a777-777777777777",
          success: false,
          error: {
            code: "INVALID_TRANSITION",
            message: "Post cannot be published",
            statusCode: 409,
          },
        },
      ],
    });
  });
});
