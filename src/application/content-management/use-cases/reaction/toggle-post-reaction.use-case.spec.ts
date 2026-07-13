import { BadRequestException, Logger } from "@nestjs/common";

import { CampusSetting, Post, PostReaction } from "@/domain/content-management";
import { CampusSettingRepository } from "../../ports/campus-setting.repository";
import { PostReactionRepository } from "../../ports/post-reaction.repository";
import { PostRepository } from "../../ports/post.repository";
import { DEFAULT_CAMPUS_ID_A, createUser } from "@/test-utils";

import { TogglePostReactionUseCase } from "./toggle-post-reaction.use-case";

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

describe("TogglePostReactionUseCase", () => {
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
    findByPostAndUser: jest.Mock;
    existsByPostAndUser: jest.Mock;
    countByPost: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let settingRepository: { findByCampusId: jest.Mock };
  let useCase: TogglePostReactionUseCase;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation();
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    postRepository = {
      findVisibleById: jest.fn().mockResolvedValue(post()),
      findById: jest.fn(),
    };
    reactionRepository = {
      findByPostAndUser: jest.fn().mockResolvedValue(null),
      existsByPostAndUser: jest.fn().mockResolvedValue(true),
      countByPost: jest.fn().mockResolvedValue(1),
      save: jest.fn().mockImplementation(async (reaction) => reaction),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    settingRepository = { findByCampusId: jest.fn().mockResolvedValue(null) };
    useCase = new TogglePostReactionUseCase(
      postRepository as unknown as PostRepository,
      reactionRepository as unknown as PostReactionRepository,
      settingRepository as unknown as CampusSettingRepository,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it("adds a heart and returns the persisted aggregate count", async () => {
    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      POST_ID,
      guardian,
    );

    expect(reactionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ postId: POST_ID, userId: USER_ID }),
    );
    expect(result).toEqual({ hasReacted: true, reactionCount: 1 });
  });

  it("removes an existing heart", async () => {
    reactionRepository.findByPostAndUser.mockResolvedValue(
      PostReaction.create({ postId: POST_ID, userId: USER_ID }),
    );
    reactionRepository.countByPost.mockResolvedValue(0);

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      POST_ID,
      guardian,
    );

    expect(reactionRepository.delete).toHaveBeenCalledWith(POST_ID, USER_ID);
    expect(reactionRepository.save).not.toHaveBeenCalled();
    expect(result).toEqual({ hasReacted: false, reactionCount: 0 });
  });

  it("reconciles a concurrent unique race as an added heart", async () => {
    reactionRepository.save.mockRejectedValue({ code: "P2002" });
    reactionRepository.existsByPostAndUser.mockResolvedValue(true);

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      POST_ID,
      guardian,
    );

    expect(reactionRepository.existsByPostAndUser).toHaveBeenCalledWith(
      POST_ID,
      USER_ID,
    );
    expect(result).toEqual({ hasReacted: true, reactionCount: 1 });
  });

  it("does not hide a failed insert when the competing heart is absent", async () => {
    const failure = { code: "P2002" };
    reactionRepository.save.mockRejectedValue(failure);
    reactionRepository.existsByPostAndUser.mockResolvedValue(false);

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, guardian),
    ).rejects.toBe(failure);
  });

  it("refuses engagement before a scheduled publishAt", async () => {
    const scheduled = post(false);
    scheduled.publish(new Date(Date.now() + 60_000));
    postRepository.findVisibleById.mockResolvedValue(scheduled);

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, guardian),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(reactionRepository.findByPostAndUser).not.toHaveBeenCalled();
  });

  it("uses guardian-scoped visibility and refuses an unpublished result", async () => {
    postRepository.findVisibleById.mockResolvedValue(post(false));
    settingRepository.findByCampusId.mockResolvedValue(
      CampusSetting.create({
        campusId: DEFAULT_CAMPUS_ID_A,
        allowReactions: false,
      }),
    );

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, guardian),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(postRepository.findVisibleById).toHaveBeenCalledWith(
      POST_ID,
      DEFAULT_CAMPUS_ID_A,
      guardian,
    );
    expect(postRepository.findById).not.toHaveBeenCalled();
    expect(settingRepository.findByCampusId).not.toHaveBeenCalled();
    expect(reactionRepository.findByPostAndUser).not.toHaveBeenCalled();
  });
});
