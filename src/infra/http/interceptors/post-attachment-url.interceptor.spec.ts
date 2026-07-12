import {
  CallHandler,
  ExecutionContext,
  ServiceUnavailableException,
} from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";

import { StorageService } from "@/application/file-management/ports/storage.service";
import { Attachment, Post } from "@/domain/content-management";
import { PostStatus } from "@/domain/content-management/enums";
import { File } from "@/domain/file-management/entities/file.entity";
import { FileStatus } from "@/domain/file-management/enums/file-status.enum";
import {
  MAX_ATTACHMENT_URL_SIGNING_CONCURRENCY,
  PostAttachmentUrlInterceptor,
} from "./post-attachment-url.interceptor";

const FILE_ID = "55555555-5555-4555-a555-555555555555";
const POST_ID = "44444444-4444-4444-a444-444444444444";

function createFile(index = 0) {
  const suffix = index === 0 ? "" : `-${index}`;
  return File.create(
    {
      key: `files/campus-1/post/photo${suffix}.png`,
      filename: "photo.png",
      mimeType: "image/png",
      size: 123n,
      uploadedBy: "33333333-3333-4333-a333-333333333333",
      campusId: "11111111-1111-4111-a111-111111111111",
      status: FileStatus.UPLOADED,
    },
    index === 0 ? FILE_ID : `file-${index}`,
  );
}

function createPost(file: File) {
  return Post.create(
    {
      campusId: "11111111-1111-4111-a111-111111111111",
      authorId: "33333333-3333-4333-a333-333333333333",
      title: "Post",
      status: PostStatus.DRAFT,
      attachments: [
        Attachment.create(
          { postId: POST_ID, fileId: FILE_ID, order: 0, file },
          "66666666-6666-4666-a666-666666666666",
        ),
      ],
    },
    POST_ID,
  );
}

function createStorage(): jest.Mocked<StorageService> {
  return {
    getUploadSignedUrl: jest.fn(),
    delete: jest.fn(),
    getSignedUrl: jest
      .fn()
      .mockResolvedValue("https://cdn.example.test/files/photo.png"),
    getObjectMetadata: jest.fn(),
  } as jest.Mocked<StorageService>;
}

async function intercept(data: unknown, storage: jest.Mocked<StorageService>) {
  const interceptor = new PostAttachmentUrlInterceptor(storage);
  const next = { handle: jest.fn(() => of(data)) } as unknown as CallHandler;
  return lastValueFrom(
    interceptor.intercept({} as ExecutionContext, next),
  ) as Promise<any>;
}

function collectUrls(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectUrls);
  if (typeof value !== "object" || value === null) return [];

  return Object.entries(value).flatMap(([key, item]) =>
    key === "url" && typeof item === "string" ? [item] : collectUrls(item),
  );
}

describe("PostAttachmentUrlInterceptor", () => {
  it.each([
    ["detail", (post: Post) => post],
    [
      "list",
      (post: Post) => ({ data: [post], pagination: { limit: 10, offset: 0 } }),
    ],
    ["transition", (post: Post) => post],
    [
      "batch transition",
      (post: Post) => ({
        total: 1,
        succeeded: 1,
        failed: 0,
        results: [{ postId: post.id, success: true, post }],
      }),
    ],
  ])(
    "hydrates embedded attachment URLs for %s responses",
    async (_name, wrap) => {
      const storage = createStorage();
      const result = await intercept(wrap(createPost(createFile())), storage);

      expect(collectUrls(result)).toContain(
        "https://cdn.example.test/files/photo.png",
      );
      expect(storage.getSignedUrl).toHaveBeenCalledWith(
        "files/campus-1/post/photo.png",
      );
    },
  );

  it("hydrates direct attachment responses and signs duplicate keys once", async () => {
    const storage = createStorage();
    const file = createFile();
    const post = createPost(file);
    const result = await intercept(
      [post.attachments[0], post.attachments[0]],
      storage,
    );

    expect(result[0].file.url).toBe("https://cdn.example.test/files/photo.png");
    expect(result[1].file.url).toBe("https://cdn.example.test/files/photo.png");
    expect(storage.getSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("bounds unique attachment URL signing concurrency", async () => {
    const storage = createStorage();
    let active = 0;
    let maximumActive = 0;
    storage.getSignedUrl.mockImplementation(async (key) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return `https://cdn.example.test/${key}`;
    });
    const files = Array.from(
      { length: MAX_ATTACHMENT_URL_SIGNING_CONCURRENCY + 4 },
      (_, index) => createFile(index + 1),
    );

    await intercept(files, storage);

    expect(storage.getSignedUrl).toHaveBeenCalledTimes(files.length);
    expect(maximumActive).toBeLessThanOrEqual(
      MAX_ATTACHMENT_URL_SIGNING_CONCURRENCY,
    );
  });

  it("normalizes signer failures to service unavailable", async () => {
    const storage = createStorage();
    storage.getSignedUrl.mockRejectedValue(new Error("R2 signing failed"));

    await expect(intercept(createFile(), storage)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("preserves non-signer serialization failures", async () => {
    const storage = createStorage();
    const file = createFile();
    jest.spyOn(file, "toPlain").mockImplementation(() => {
      throw new TypeError("serialization failed");
    });

    await expect(intercept(file, storage)).rejects.toThrow(
      new TypeError("serialization failed"),
    );
  });
});
