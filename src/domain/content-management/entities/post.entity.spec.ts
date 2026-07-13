import {
  AudienceType,
  Post,
  PostAudience,
  PostStatus,
} from "@/domain/content-management";

const POST_ID = "44444444-4444-4444-a444-444444444444";

function publishedPost(publishAt: Date | null): Post {
  return Post.create(
    {
      campusId: "11111111-1111-4111-a111-111111111111",
      authorId: "33333333-3333-4333-a333-333333333333",
      title: "Scheduled post",
      status: PostStatus.PUBLISHED,
      publishAt,
    },
    POST_ID,
  );
}

describe("Post audience invariant", () => {
  const post = () =>
    Post.create({
      campusId: "11111111-1111-4111-a111-111111111111",
      authorId: "33333333-3333-4333-a333-333333333333",
      title: "Audience post",
    });

  it("rejects an empty audience replacement", () => {
    expect(() => post().setAudiences([])).toThrow(
      "Post must have at least one audience",
    );
  });

  it("prevents removing the final audience", () => {
    const value = post();
    const audience = PostAudience.create({
      postId: value.id,
      campusId: value.campusId,
      audienceType: AudienceType.ALL,
      audienceId: value.campusId,
    });
    value.setAudiences([audience]);

    expect(() => value.removeAudience(audience.id)).toThrow(
      "Post must have at least one audience",
    );
  });

  it("rejects audiences owned by another post", () => {
    const value = post();
    const audience = PostAudience.create({
      postId: "66666666-6666-4666-a666-666666666666",
      campusId: value.campusId,
      audienceType: AudienceType.ALL,
      audienceId: value.campusId,
    });

    expect(() => value.setAudiences([audience])).toThrow(
      "must belong to its post and campus",
    );
  });

  it("rejects duplicate audiences", () => {
    const value = post();
    const audience = () =>
      PostAudience.create({
        postId: value.id,
        campusId: value.campusId,
        audienceType: AudienceType.CLASS,
        audienceId: "55555555-5555-4555-a555-555555555555",
      });

    expect(() => value.setAudiences([audience(), audience()])).toThrow(
      "must not contain duplicates",
    );
  });
});

describe("Post engagement eligibility", () => {
  const now = new Date("2026-07-12T12:00:00.000Z");

  it("excludes future-scheduled posts from engagement", () => {
    const post = publishedPost(new Date("2026-07-12T12:00:01.000Z"));

    expect(post.canReceiveEngagement(now)).toBe(false);
  });

  it.each([
    null,
    new Date("2026-07-12T12:00:00.000Z"),
    new Date("2026-07-12T11:59:59.000Z"),
  ])("allows published posts once publishAt is due: %s", (publishAt) => {
    expect(publishedPost(publishAt).canReceiveEngagement(now)).toBe(true);
  });
});
