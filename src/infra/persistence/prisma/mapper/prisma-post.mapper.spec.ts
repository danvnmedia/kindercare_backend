import { AudienceType, PostStatus } from "@/domain/content-management";
import {
  PrismaPostMapper,
  PrismaPostWithRelations,
} from "./prisma-post.mapper";

const postRowFactory = (
  overrides: Partial<PrismaPostWithRelations> = {},
): PrismaPostWithRelations =>
  ({
    id: "post-1",
    campusId: "campus-1",
    authorId: "user-1",
    title: "Class update",
    content: null,
    contentText: null,
    contentVersion: 1,
    status: PostStatus.DRAFT,
    publishAt: null,
    clientMutationId: null,
    isPinned: false,
    pinnedUntil: null,
    pinnedById: null,
    requiresApproval: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    author: {
      id: "user-1",
      clerkUid: "clerk-1",
      isActive: true,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    },
    audiences: [
      {
        id: "audience-class-1",
        postId: "post-1",
        campusId: "campus-1",
        type: AudienceType.CLASS,
        classId: "class-1",
        class: { id: "class-1", name: "Sunflower" },
      },
      {
        id: "audience-all-1",
        postId: "post-1",
        campusId: "campus-1",
        type: AudienceType.ALL,
        classId: null,
        class: null,
      },
    ],
    attachments: [],
    categories: [],
    ...overrides,
  }) as PrismaPostWithRelations;

describe("PrismaPostMapper", () => {
  it("hydrates CLASS and ALL audiences with domain IDs and class metadata", () => {
    const post = PrismaPostMapper.toDomain(postRowFactory());

    expect(post.audiences).toHaveLength(2);
    expect(post.audiences[0]).toMatchObject({
      id: "audience-class-1",
      audienceType: AudienceType.CLASS,
      audienceId: "class-1",
    });
    expect(post.audiences[0].toPlain()).toEqual(
      expect.objectContaining({
        type: AudienceType.CLASS,
        classId: "class-1",
        class: { id: "class-1", name: "Sunflower" },
      }),
    );
    expect(post.audiences[1]).toMatchObject({
      id: "audience-all-1",
      audienceType: AudienceType.ALL,
      audienceId: "campus-1",
    });
  });

  it("projects only author profiles from the post campus", () => {
    const profileBase = {
      phoneNumber: "+15550000001",
      address: null,
      dateOfBirth: null,
      gender: null,
      isArchived: false,
      userId: "user-1",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    };
    const post = PrismaPostMapper.toDomain(
      postRowFactory({
        author: {
          ...postRowFactory().author,
          staffs: [],
          guardians: [
            {
              ...profileBase,
              id: "guardian-campus-1",
              campusId: "campus-1",
              fullName: "Campus One Guardian",
              email: "campus-one@example.com",
              occupation: null,
              workAddress: null,
            },
            {
              ...profileBase,
              id: "guardian-campus-2",
              campusId: "campus-2",
              fullName: "Campus Two Guardian",
              email: "private-other-campus@example.com",
              occupation: null,
              workAddress: null,
            },
          ],
        },
      }),
    );

    expect(post.author?.profiles).toEqual([
      expect.objectContaining({
        id: "guardian-campus-1",
        campusId: "campus-1",
        fullName: "Campus One Guardian",
        email: "campus-one@example.com",
      }),
    ]);
    expect(post.author?.profiles).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: "private-other-campus@example.com" }),
      ]),
    );
  });

  it("rejects a persisted CLASS audience without classId", () => {
    const row = postRowFactory({
      audiences: [
        {
          id: "audience-class-1",
          postId: "post-1",
          campusId: "campus-1",
          type: AudienceType.CLASS,
          classId: null,
          class: null,
        },
      ],
    });

    expect(() => PrismaPostMapper.toDomain(row)).toThrow(
      "Post audience audience-class-1 is CLASS but has no classId",
    );
  });
});
