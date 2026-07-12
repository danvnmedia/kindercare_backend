import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { AudienceType, PostStatus } from "@/domain/content-management";
import { UserProfile } from "@/domain/user-management/user.entity";
import { createRole, createRoleAssignment, createUser } from "@/test-utils";
import { PrismaService } from "../prisma.service";
import { PrismaPostWithRelations } from "../mapper/prisma-post.mapper";
import { PrismaPostRepository } from "./prisma-post.repository";

const guardianProfile = (id: string, campusId: string): UserProfile => ({
  type: "guardian",
  id,
  campusId,
  fullName: id,
  email: `${id}@example.com`,
  phoneNumber: null,
  dateOfBirth: null,
  gender: null,
});

const staffProfile = (id: string, campusId: string): UserProfile => ({
  type: "staff",
  id,
  campusId,
  fullName: id,
  email: `${id}@example.com`,
  phoneNumber: null,
  dateOfBirth: null,
  gender: null,
});

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
    ],
    attachments: [],
    categories: [],
    ...overrides,
  }) as PrismaPostWithRelations;

describe("PrismaPostRepository", () => {
  let postDelegate: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  let queryService: jest.Mocked<PrismaQueryService>;
  let repository: PrismaPostRepository;

  beforeEach(() => {
    postDelegate = {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    };
    queryService = {
      executeQuery: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    } as unknown as jest.Mocked<PrismaQueryService>;
    repository = new PrismaPostRepository(
      { post: postDelegate } as unknown as PrismaService,
      queryService,
    );
  });

  it("preserves hydrated audiences when a status-only change is persisted", async () => {
    postDelegate.findFirst.mockResolvedValue(postRowFactory());
    postDelegate.update.mockResolvedValue(
      postRowFactory({ status: PostStatus.PENDING_REVIEW }),
    );

    const post = await repository.findById("post-1");
    expect(post).not.toBeNull();

    post!.submitForReview();
    await repository.update(post!.id, post!);

    expect(postDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "post-1" },
        data: expect.objectContaining({
          status: PostStatus.PENDING_REVIEW,
          audiences: {
            deleteMany: {},
            create: [
              {
                id: "audience-class-1",
                type: AudienceType.CLASS,
                campusId: "campus-1",
                classId: "class-1",
              },
            ],
          },
        }),
      }),
    );
  });

  it("strips audience relation filters before delegating to the flat Prisma query builder", async () => {
    const query: StandardRequestDto = {
      filterInfo: {
        filters: {
          audienceType: { eq: AudienceType.CLASS },
          classId: { eq: "class-1" },
          status: { in: [PostStatus.DRAFT, PostStatus.PUBLISHED] },
        },
      },
      sort: "status,-createdAt",
    };

    await repository.findMany(query, { campusId: "campus-1" });

    expect(queryService.executeQuery).toHaveBeenCalledTimes(1);
    const [, modelName, passedQuery, options, mapper] =
      queryService.executeQuery.mock.calls[0];

    expect(modelName).toBe("post");
    expect(passedQuery.filter).toBeUndefined();
    expect(passedQuery.filterInfo?.filters).toEqual({
      status: { in: [PostStatus.DRAFT, PostStatus.PUBLISHED] },
    });
    expect(passedQuery.allowedFilterFields).toEqual(
      expect.arrayContaining(["status", "publishAt"]),
    );
    expect(passedQuery.allowedFilterFields).not.toEqual(
      expect.arrayContaining(["audienceType", "classId"]),
    );
    expect(passedQuery.allowedSortFields).toContain("status");
    expect(options).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          isDeleted: false,
          audiences: {
            some: { type: AudienceType.CLASS, classId: "class-1" },
          },
        }),
        scope: { campusId: "campus-1" },
      }),
    );
    expect(mapper).toBeDefined();
  });

  it("uses the guardian profile matching the requested campus and enforces published audience visibility", async () => {
    const viewer = createUser({
      profiles: [
        guardianProfile("guardian-campus-1", "campus-1"),
        guardianProfile("guardian-campus-2", "campus-2"),
      ],
    });
    postDelegate.findFirst.mockResolvedValue(null);

    await repository.findVisibleById("post-1", "campus-2", viewer);

    expect(postDelegate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "post-1",
          campusId: "campus-2",
          isDeleted: false,
          AND: [
            {
              status: PostStatus.PUBLISHED,
              OR: [
                { publishAt: null },
                { publishAt: { lte: expect.any(Date) } },
              ],
            },
            {
              OR: [
                {
                  audiences: {
                    some: {
                      type: AudienceType.ALL,
                      campusId: "campus-2",
                    },
                  },
                },
                {
                  audiences: {
                    some: {
                      type: AudienceType.CLASS,
                      campusId: "campus-2",
                      class: {
                        campusId: "campus-2",
                        enrollments: {
                          some: {
                            endDate: null,
                            student: {
                              campusId: "campus-2",
                              guardians: {
                                some: { guardianId: "guardian-campus-2" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      }),
    );
  });

  it("applies published audience visibility to pinned guardian reads", async () => {
    const viewer = createUser({
      profiles: [guardianProfile("guardian-campus-1", "campus-1")],
    });
    postDelegate.findMany.mockResolvedValue([]);

    await repository.findPinnedByCampus("campus-1", viewer);

    expect(postDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campusId: "campus-1",
          isPinned: true,
          AND: expect.arrayContaining([
            expect.objectContaining({
              status: PostStatus.PUBLISHED,
              OR: [
                { publishAt: null },
                { publishAt: { lte: expect.any(Date) } },
              ],
            }),
          ]),
        }),
      }),
    );
  });

  it("keeps future-scheduled posts out of pinned reads for managers", async () => {
    const viewer = createUser({
      profiles: [staffProfile("manager-campus-1", "campus-1")],
      roleAssignments: [
        createRoleAssignment(
          createRole({
            permissions: [
              {
                id: "post.manage",
                module: "post",
                description: null,
                createdAt: new Date(),
              },
            ],
          }),
          "campus-1",
        ),
      ],
    });
    postDelegate.findMany.mockResolvedValue([]);

    await repository.findPinnedByCampus("campus-1", viewer);

    expect(postDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            {
              status: PostStatus.PUBLISHED,
              OR: [
                { publishAt: null },
                { publishAt: { lte: expect.any(Date) } },
              ],
            },
          ]),
        }),
      }),
    );
  });

  it("limits non-manager staff to published posts or their own unpublished posts", async () => {
    const role = createRole({
      permissions: [
        {
          id: "post.read",
          module: "post",
          description: null,
          createdAt: new Date(),
        },
      ],
    });
    const viewer = createUser({
      id: "staff-user-1",
      profiles: [
        guardianProfile("guardian-campus-1", "campus-1"),
        staffProfile("staff-campus-1", "campus-1"),
      ],
      roleAssignments: [createRoleAssignment(role, "campus-1")],
    });

    await repository.findMany({}, { campusId: "campus-1" }, viewer);

    const [, , , options] = queryService.executeQuery.mock.calls[0];
    expect(options!.where).toEqual(
      expect.objectContaining({
        AND: [
          {
            OR: [
              {
                status: PostStatus.PUBLISHED,
                OR: [
                  { publishAt: null },
                  { publishAt: { lte: expect.any(Date) } },
                ],
              },
              { authorId: "staff-user-1" },
            ],
          },
        ],
      }),
    );
  });

  it.each(["post.manage", "post.review"])(
    "grants management visibility to staff with %s",
    async (permissionId) => {
      const role = createRole({
        permissions: [
          {
            id: permissionId,
            module: "post",
            description: null,
            createdAt: new Date(),
          },
        ],
      });
      const viewer = createUser({
        id: "manager-user-1",
        profiles: [staffProfile("manager-campus-1", "campus-1")],
        roleAssignments: [createRoleAssignment(role, "campus-1")],
      });

      await repository.findMany({}, { campusId: "campus-1" }, viewer);

      const [, , , options] = queryService.executeQuery.mock.calls[0];
      expect(options!.where).not.toHaveProperty("OR");
      expect(options!.where).not.toHaveProperty("AND");
    },
  );

  it("does not let a campus A system role grant unpublished visibility in campus B", async () => {
    const viewer = createUser({
      id: "staff-user-1",
      profiles: [staffProfile("staff-campus-2", "campus-2")],
      roleAssignments: [
        createRoleAssignment(
          createRole({ campusId: "campus-1", isSystemRole: true }),
          "campus-1",
        ),
        createRoleAssignment(
          createRole({
            campusId: "campus-2",
            permissions: [
              {
                id: "post.read",
                module: "post",
                description: null,
                createdAt: new Date(),
              },
            ],
          }),
          "campus-2",
        ),
      ],
    });

    await repository.findMany({}, { campusId: "campus-2" }, viewer);

    const [, , , options] = queryService.executeQuery.mock.calls[0];
    expect(options!.where).toEqual(
      expect.objectContaining({
        AND: [
          {
            OR: [
              {
                status: PostStatus.PUBLISHED,
                OR: [
                  { publishAt: null },
                  { publishAt: { lte: expect.any(Date) } },
                ],
              },
              { authorId: "staff-user-1" },
            ],
          },
        ],
      }),
    );
  });

  it("allows a globally assigned system role unpublished visibility in campus B", async () => {
    const viewer = createUser({
      profiles: [staffProfile("staff-campus-2", "campus-2")],
      roleAssignments: [
        createRoleAssignment(createRole({ isSystemRole: true })),
        createRoleAssignment(
          createRole({
            campusId: "campus-2",
            permissions: [
              {
                id: "post.read",
                module: "post",
                description: null,
                createdAt: new Date(),
              },
            ],
          }),
          "campus-2",
        ),
      ],
    });

    await repository.findMany({}, { campusId: "campus-2" }, viewer);

    const [, , , options] = queryService.executeQuery.mock.calls[0];
    expect(options!.where).not.toHaveProperty("OR");
    expect(options!.where).not.toHaveProperty("AND");
  });

  it("fails closed when the guardian has no active profile in the requested campus", async () => {
    const viewer = createUser({
      profiles: [guardianProfile("guardian-campus-1", "campus-1")],
    });

    await repository.findVisibleById("post-1", "campus-2", viewer);

    expect(postDelegate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [] } }),
      }),
    );
  });

  it("keeps the published constraint inside AND so a guardian status filter cannot override it", async () => {
    const query: StandardRequestDto = {
      filterInfo: { filters: { status: { eq: PostStatus.DRAFT } } },
    };
    const viewer = createUser({
      profiles: [guardianProfile("guardian-campus-1", "campus-1")],
    });

    await repository.findMany(query, { campusId: "campus-1" }, viewer);

    const [, , passedQuery, options] = queryService.executeQuery.mock.calls[0];
    expect(passedQuery.filterInfo?.filters).toEqual({
      status: { eq: PostStatus.DRAFT },
    });
    expect(options!.where).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({
            status: PostStatus.PUBLISHED,
            OR: [{ publishAt: null }, { publishAt: { lte: expect.any(Date) } }],
          }),
        ]),
      }),
    );
  });

  it("sanitizes relation filters parsed from the raw JSON filter", async () => {
    const query: StandardRequestDto = {
      filter: JSON.stringify({
        audienceType: { eq: AudienceType.ALL },
        title: { ilike: "notice" },
      }),
    };

    await repository.findMany(query);

    const [, , passedQuery, options] = queryService.executeQuery.mock.calls[0];
    expect(passedQuery.filter).toBeUndefined();
    expect(passedQuery.filterInfo?.filters).toEqual({
      title: { ilike: "notice" },
    });
    expect(options).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          audiences: { some: { type: AudienceType.ALL } },
        }),
      }),
    );
  });
});
