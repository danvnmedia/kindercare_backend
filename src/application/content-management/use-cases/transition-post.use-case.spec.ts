import { BadRequestException, ForbiddenException } from "@nestjs/common";

import { Post } from "@/domain/content-management";
import { PostTransitionAction } from "@/domain/content-management/enums";
import {
  DEFAULT_CAMPUS_ID_A,
  createPermission,
  createRole,
  createRoleAssignment,
  createUser,
} from "@/test-utils";

import { ApprovePostUseCase } from "./approve-post.use-case";
import { ArchivePostUseCase } from "./archive-post.use-case";
import { PublishPostUseCase } from "./publish-post.use-case";
import { RejectPostUseCase } from "./reject-post.use-case";
import { RevisePostUseCase } from "./revise-post.use-case";
import { SubmitForReviewUseCase } from "./submit-for-review.use-case";
import { TransitionPostUseCase } from "./transition-post.use-case";

const USER_ID = "33333333-3333-4333-a333-333333333333";
const POST_ID = "44444444-4444-4444-a444-444444444444";
const post = Post.create(
  {
    campusId: DEFAULT_CAMPUS_ID_A,
    authorId: USER_ID,
    title: "Post",
  },
  POST_ID,
);

describe("TransitionPostUseCase", () => {
  const userWithPermissions = (...permissionIds: string[]) =>
    createUser({
      id: USER_ID,
      roleAssignments: [
        createRoleAssignment(
          createRole({
            permissions: permissionIds.map((id) =>
              createPermission({ id, module: "post" }),
            ),
          }),
          DEFAULT_CAMPUS_ID_A,
        ),
      ],
    });
  const user = userWithPermissions("post.update", "post.review");
  let approve: { execute: jest.Mock };
  let archive: { execute: jest.Mock };
  let publish: { execute: jest.Mock };
  let reject: { execute: jest.Mock };
  let revise: { execute: jest.Mock };
  let submit: { execute: jest.Mock };
  let useCase: TransitionPostUseCase;

  beforeEach(() => {
    approve = { execute: jest.fn().mockResolvedValue(post) };
    archive = { execute: jest.fn().mockResolvedValue(post) };
    publish = { execute: jest.fn().mockResolvedValue(post) };
    reject = { execute: jest.fn().mockResolvedValue(post) };
    revise = { execute: jest.fn().mockResolvedValue(post) };
    submit = { execute: jest.fn().mockResolvedValue(post) };
    useCase = new TransitionPostUseCase(
      approve as unknown as ApprovePostUseCase,
      archive as unknown as ArchivePostUseCase,
      publish as unknown as PublishPostUseCase,
      reject as unknown as RejectPostUseCase,
      revise as unknown as RevisePostUseCase,
      submit as unknown as SubmitForReviewUseCase,
    );
  });

  it.each([
    [PostTransitionAction.APPROVE, "approve"],
    [PostTransitionAction.ARCHIVE, "archive"],
    [PostTransitionAction.PUBLISH, "publish"],
    [PostTransitionAction.REVISE, "revise"],
    [PostTransitionAction.SUBMIT, "submit"],
  ])(
    "forwards accepted %s comments to the workflow use case",
    async (action, target) => {
      await useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        POST_ID,
        action,
        user,
        "Transition context",
      );

      const selected = {
        approve,
        archive,
        publish,
        revise,
        submit,
      }[target as "approve" | "archive" | "publish" | "revise" | "submit"];
      expect(selected.execute).toHaveBeenCalledWith(
        DEFAULT_CAMPUS_ID_A,
        POST_ID,
        user,
        "Transition context",
      );
    },
  );

  it.each([PostTransitionAction.APPROVE, PostTransitionAction.REJECT])(
    "requires post.review for %s",
    async (action) => {
      await expect(
        useCase.execute(
          DEFAULT_CAMPUS_ID_A,
          POST_ID,
          action,
          userWithPermissions("post.update"),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it.each([
    PostTransitionAction.ARCHIVE,
    PostTransitionAction.PUBLISH,
    PostTransitionAction.REVISE,
    PostTransitionAction.SUBMIT,
  ])("requires post.update for %s", async (action) => {
    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        POST_ID,
        action,
        userWithPermissions("post.review"),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(Object.values(PostTransitionAction))(
    "lets post.manage perform %s",
    async (action) => {
      await expect(
        useCase.execute(
          DEFAULT_CAMPUS_ID_A,
          POST_ID,
          action,
          userWithPermissions("post.manage"),
          action === PostTransitionAction.REJECT ? "Reason" : undefined,
        ),
      ).resolves.toBe(post);
    },
  );

  it("normalizes a missing rejection comment for use-case validation", async () => {
    await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      POST_ID,
      PostTransitionAction.REJECT,
      user,
    );

    expect(reject.execute).toHaveBeenCalledWith(
      DEFAULT_CAMPUS_ID_A,
      POST_ID,
      user,
      "",
    );
  });

  it("rejects unknown actions as bad requests", async () => {
    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        POST_ID,
        "UNKNOWN" as PostTransitionAction,
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
