import { BadRequestException, Logger, NotFoundException } from "@nestjs/common";

import { CampusSetting, Post } from "@/domain/content-management";
import { DEFAULT_CAMPUS_ID_A, createUser } from "@/test-utils";

import { CampusSettingRepository } from "../../ports/campus-setting.repository";
import { PostReactionRepository } from "../../ports/post-reaction.repository";
import { PostRepository } from "../../ports/post.repository";
import { GetPostReactionStatusUseCase } from "./get-post-reaction-status.use-case";

const USER_ID = "33333333-3333-4333-a333-333333333333";
const POST_ID = "44444444-4444-4444-a444-444444444444";

function post(published = true): Post {
  const value = Post.create(
    {
      campusId: DEFAULT_CAMPUS_ID_A,
      authorId: USER_ID,
      title: "Class update",
    },
    POST_ID,
  );
  if (published) value.publish();
  return value;
}

describe("GetPostReactionStatusUseCase", () => {
  const guardian = createUser({
    id: USER_ID,
    profiles: [
      {
        type: "guardian",
        id: "guardian-1",
        campusId: DEFAULT_CAMPUS_ID_A,
        fullName: "Guardian",
        email: null,
        phoneNumber: null,
        dateOfBirth: null,
        gender: null,
      },
    ],
  });
  let postRepository: { findVisibleById: jest.Mock; findById: jest.Mock };
  let reactionRepository: {
    existsByPostAndUser: jest.Mock;
    countByPost: jest.Mock;
  };
  let settingRepository: { findByCampusId: jest.Mock };
  let useCase: GetPostReactionStatusUseCase;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    postRepository = {
      findVisibleById: jest.fn().mockResolvedValue(post()),
      findById: jest.fn(),
    };
    reactionRepository = {
      existsByPostAndUser: jest.fn().mockResolvedValue(true),
      countByPost: jest.fn().mockResolvedValue(4),
    };
    settingRepository = { findByCampusId: jest.fn().mockResolvedValue(null) };
    useCase = new GetPostReactionStatusUseCase(
      postRepository as unknown as PostRepository,
      reactionRepository as unknown as PostReactionRepository,
      settingRepository as unknown as CampusSettingRepository,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it("returns the current user's heart state and total", async () => {
    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, guardian),
    ).resolves.toEqual({ hasReacted: true, reactionCount: 4 });

    expect(reactionRepository.existsByPostAndUser).toHaveBeenCalledWith(
      POST_ID,
      USER_ID,
    );
    expect(reactionRepository.countByPost).toHaveBeenCalledWith(POST_ID);
  });

  it("returns an empty status when reactions are disabled on a published post", async () => {
    settingRepository.findByCampusId.mockResolvedValue(
      CampusSetting.create({
        campusId: DEFAULT_CAMPUS_ID_A,
        allowReactions: false,
      }),
    );

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, guardian),
    ).resolves.toEqual({ hasReacted: false, reactionCount: 0 });

    expect(reactionRepository.existsByPostAndUser).not.toHaveBeenCalled();
    expect(reactionRepository.countByPost).not.toHaveBeenCalled();
  });

  it("keeps guardian visibility scoped through findVisibleById", async () => {
    postRepository.findVisibleById.mockResolvedValue(null);

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, guardian),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(postRepository.findVisibleById).toHaveBeenCalledWith(
      POST_ID,
      DEFAULT_CAMPUS_ID_A,
      guardian,
    );
    expect(postRepository.findById).not.toHaveBeenCalled();
  });

  it("refuses an unpublished post before consulting settings or reactions", async () => {
    postRepository.findVisibleById.mockResolvedValue(post(false));

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, guardian),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(settingRepository.findByCampusId).not.toHaveBeenCalled();
    expect(reactionRepository.existsByPostAndUser).not.toHaveBeenCalled();
    expect(reactionRepository.countByPost).not.toHaveBeenCalled();
  });
});
