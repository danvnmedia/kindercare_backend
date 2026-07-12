import { Post, PostStatus } from "@/domain/content-management";

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
