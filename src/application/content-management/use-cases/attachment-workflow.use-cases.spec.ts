import { FileRepository } from "@/application/file-management/ports/file.repository";
import { Attachment, Post, PostStatus } from "@/domain/content-management";
import { File } from "@/domain/file-management/entities/file.entity";
import { FilePurpose } from "@/domain/file-management/enums/file-purpose.enum";
import { FileStatus } from "@/domain/file-management/enums/file-status.enum";
import {
  createPermission,
  createRole,
  createRoleAssignment,
  createUser,
  DEFAULT_CAMPUS_ID_A,
  DEFAULT_CAMPUS_ID_B,
} from "@/test-utils/entity-factories";
import { ForbiddenException, Logger } from "@nestjs/common";
import {
  AttachmentOrderConflictError,
  AttachmentRepository,
} from "../ports/attachment.repository";
import { PostRepository } from "../ports/post.repository";
import { AddAttachmentUseCase } from "./add-attachment.use-case";
import { RemoveAttachmentUseCase } from "./remove-attachment.use-case";
import { ReorderAttachmentsUseCase } from "./reorder-attachments.use-case";

const AUTHOR_ID = "33333333-3333-4333-a333-333333333333";
const OTHER_USER_ID = "88888888-8888-4888-a888-888888888888";
const POST_ID = "44444444-4444-4444-a444-444444444444";
const FILE_ID = "55555555-5555-4555-a555-555555555555";
const ATTACHMENT_ID_A = "66666666-6666-4666-a666-666666666666";
const ATTACHMENT_ID_B = "77777777-7777-4777-a777-777777777777";

const author = createUser({ id: AUTHOR_ID });
const updaterOnly = createUser({
  id: OTHER_USER_ID,
  roleAssignments: [
    createRoleAssignment(
      createRole({
        permissions: [createPermission({ id: "post.update", module: "post" })],
      }),
      DEFAULT_CAMPUS_ID_A,
    ),
  ],
});
const manager = createUser({
  id: OTHER_USER_ID,
  roleAssignments: [
    createRoleAssignment(
      createRole({
        permissions: [createPermission({ id: "post.manage", module: "post" })],
      }),
      DEFAULT_CAMPUS_ID_A,
    ),
  ],
});

function createPost(status: PostStatus): Post {
  return Post.create(
    {
      campusId: DEFAULT_CAMPUS_ID_A,
      authorId: AUTHOR_ID,
      author,
      title: "Campus update",
      status,
    },
    POST_ID,
  );
}

function createAttachment(id: string, order: number): Attachment {
  return Attachment.create(
    { postId: POST_ID, fileId: `${id.slice(0, -1)}8`, order },
    id,
  );
}

function createFile(
  overrides: Partial<{
    status: FileStatus;
    purpose: FilePurpose;
    uploadedBy: string;
    campusId: string;
  }> = {},
): File {
  return File.create(
    {
      key: "cms/file.jpg",
      filename: "file.jpg",
      mimeType: "image/jpeg",
      size: 10n,
      status: overrides.status ?? FileStatus.UPLOADED,
      purpose: overrides.purpose ?? FilePurpose.POST_ATTACHMENT,
      uploadedBy: overrides.uploadedBy ?? AUTHOR_ID,
      campusId: overrides.campusId ?? DEFAULT_CAMPUS_ID_A,
    },
    FILE_ID,
  );
}

describe("post attachment workflow integrity", () => {
  let postRepository: jest.Mocked<PostRepository>;
  let attachmentRepository: jest.Mocked<AttachmentRepository>;
  let fileRepository: jest.Mocked<FileRepository>;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    postRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<PostRepository>;
    attachmentRepository = {
      appendToPost: jest.fn(),
      removeAndCompact: jest.fn(),
      findByPostId: jest.fn(),
      updateOrder: jest.fn(),
    } as unknown as jest.Mocked<AttachmentRepository>;
    fileRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<FileRepository>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    [
      "add",
      () =>
        new AddAttachmentUseCase(
          attachmentRepository,
          postRepository,
          fileRepository,
        ).execute(
          { postId: POST_ID, fileId: FILE_ID, campusId: DEFAULT_CAMPUS_ID_A },
          author,
        ),
    ],
    [
      "remove",
      () =>
        new RemoveAttachmentUseCase(
          attachmentRepository,
          postRepository,
        ).execute(DEFAULT_CAMPUS_ID_A, POST_ID, ATTACHMENT_ID_A, author),
    ],
    [
      "reorder",
      () =>
        new ReorderAttachmentsUseCase(
          attachmentRepository,
          postRepository,
        ).execute(
          {
            postId: POST_ID,
            campusId: DEFAULT_CAMPUS_ID_A,
            orders: [{ id: ATTACHMENT_ID_A, order: 0 }],
          },
          author,
        ),
    ],
  ])(
    "rejects %s in immutable workflow states before attachment writes",
    async (_name, execute) => {
      for (const status of [PostStatus.PENDING_REVIEW, PostStatus.ARCHIVED]) {
        postRepository.findById.mockResolvedValue(createPost(status));

        await expect(execute()).rejects.toMatchObject({
          response: expect.objectContaining({
            currentStatus: status,
            requiredStatus: PostStatus.DRAFT,
          }),
        });
      }

      expect(attachmentRepository.appendToPost).not.toHaveBeenCalled();
      expect(attachmentRepository.removeAndCompact).not.toHaveBeenCalled();
      expect(attachmentRepository.updateOrder).not.toHaveBeenCalled();
    },
  );

  it("passes actor context so published add can be demoted atomically", async () => {
    const attachment = createAttachment(ATTACHMENT_ID_A, 0);
    postRepository.findById.mockResolvedValue(createPost(PostStatus.PUBLISHED));
    fileRepository.findById.mockResolvedValue(createFile());
    attachmentRepository.findByPostId.mockResolvedValue([]);
    attachmentRepository.appendToPost.mockResolvedValue(attachment);

    const result = await new AddAttachmentUseCase(
      attachmentRepository,
      postRepository,
      fileRepository,
    ).execute(
      { postId: POST_ID, fileId: FILE_ID, campusId: DEFAULT_CAMPUS_ID_A },
      author,
    );

    expect(result).toBe(attachment);
    expect(attachmentRepository.appendToPost).toHaveBeenCalledWith(
      expect.any(Attachment),
      {
        changedById: AUTHOR_ID,
        reason: "Attachment added",
        canAttachAnyFile: false,
      },
    );
  });

  it.each([
    [
      "add",
      () =>
        new AddAttachmentUseCase(
          attachmentRepository,
          postRepository,
          fileRepository,
        ).execute(
          { postId: POST_ID, fileId: FILE_ID, campusId: DEFAULT_CAMPUS_ID_A },
          updaterOnly,
        ),
    ],
    [
      "remove",
      () =>
        new RemoveAttachmentUseCase(
          attachmentRepository,
          postRepository,
        ).execute(DEFAULT_CAMPUS_ID_A, POST_ID, ATTACHMENT_ID_A, updaterOnly),
    ],
    [
      "reorder",
      () =>
        new ReorderAttachmentsUseCase(
          attachmentRepository,
          postRepository,
        ).execute(
          {
            postId: POST_ID,
            campusId: DEFAULT_CAMPUS_ID_A,
            orders: [{ id: ATTACHMENT_ID_A, order: 0 }],
          },
          updaterOnly,
        ),
    ],
  ])(
    "rejects cross-author %s with post.update only",
    async (_name, execute) => {
      postRepository.findById.mockResolvedValue(createPost(PostStatus.DRAFT));

      await expect(execute()).rejects.toBeInstanceOf(ForbiddenException);
      expect(attachmentRepository.appendToPost).not.toHaveBeenCalled();
      expect(attachmentRepository.removeAndCompact).not.toHaveBeenCalled();
      expect(attachmentRepository.updateOrder).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "remove",
      () =>
        new RemoveAttachmentUseCase(
          attachmentRepository,
          postRepository,
        ).execute(DEFAULT_CAMPUS_ID_A, POST_ID, ATTACHMENT_ID_A, manager),
      () => attachmentRepository.removeAndCompact,
    ],
    [
      "reorder",
      () =>
        new ReorderAttachmentsUseCase(
          attachmentRepository,
          postRepository,
        ).execute(
          {
            postId: POST_ID,
            campusId: DEFAULT_CAMPUS_ID_A,
            orders: [{ id: ATTACHMENT_ID_A, order: 0 }],
          },
          manager,
        ),
      () => attachmentRepository.updateOrder,
    ],
  ])(
    "lets post.manage perform cross-author %s",
    async (name, execute, getWrite) => {
      postRepository.findById.mockResolvedValue(createPost(PostStatus.DRAFT));
      attachmentRepository.findByPostId.mockResolvedValue([
        createAttachment(ATTACHMENT_ID_A, 0),
      ]);

      const result = await execute();
      if (name === "reorder") {
        expect(result).toEqual(
          expect.objectContaining({ status: PostStatus.DRAFT }),
        );
      } else {
        expect(result).toBeUndefined();
      }
      expect(getWrite()).toHaveBeenCalled();
    },
  );

  it("lets post.manage attach another uploader's eligible file", async () => {
    const attachment = createAttachment(ATTACHMENT_ID_A, 0);
    postRepository.findById.mockResolvedValue(createPost(PostStatus.DRAFT));
    fileRepository.findById.mockResolvedValue(createFile());
    attachmentRepository.findByPostId.mockResolvedValue([]);
    attachmentRepository.appendToPost.mockResolvedValue(attachment);

    await expect(
      new AddAttachmentUseCase(
        attachmentRepository,
        postRepository,
        fileRepository,
      ).execute(
        { postId: POST_ID, fileId: FILE_ID, campusId: DEFAULT_CAMPUS_ID_A },
        manager,
      ),
    ).resolves.toBe(attachment);
    expect(attachmentRepository.appendToPost).toHaveBeenCalledWith(
      expect.any(Attachment),
      expect.objectContaining({ canAttachAnyFile: true }),
    );
  });

  it("rejects another uploader's file without post.manage", async () => {
    postRepository.findById.mockResolvedValue(createPost(PostStatus.DRAFT));
    fileRepository.findById.mockResolvedValue(
      createFile({ uploadedBy: OTHER_USER_ID }),
    );

    await expect(
      new AddAttachmentUseCase(
        attachmentRepository,
        postRepository,
        fileRepository,
      ).execute(
        { postId: POST_ID, fileId: FILE_ID, campusId: DEFAULT_CAMPUS_ID_A },
        author,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(attachmentRepository.appendToPost).not.toHaveBeenCalled();
  });

  it.each([FilePurpose.PROFILE_PHOTO, FilePurpose.ATTENDANCE_IMAGE])(
    "rejects %s file reuse as a post attachment",
    async (purpose) => {
      postRepository.findById.mockResolvedValue(createPost(PostStatus.DRAFT));
      fileRepository.findById.mockResolvedValue(createFile({ purpose }));

      await expect(
        new AddAttachmentUseCase(
          attachmentRepository,
          postRepository,
          fileRepository,
        ).execute(
          {
            postId: POST_ID,
            fileId: FILE_ID,
            campusId: DEFAULT_CAMPUS_ID_A,
          },
          author,
        ),
      ).rejects.toThrow(
        "Only files uploaded for post attachments can be attached",
      );
      expect(attachmentRepository.appendToPost).not.toHaveBeenCalled();
    },
  );

  it("rejects unavailable and cross-campus files", async () => {
    postRepository.findById.mockResolvedValue(createPost(PostStatus.DRAFT));
    const useCase = new AddAttachmentUseCase(
      attachmentRepository,
      postRepository,
      fileRepository,
    );

    fileRepository.findById.mockResolvedValue(
      createFile({ status: FileStatus.PENDING }),
    );
    await expect(
      useCase.execute(
        { postId: POST_ID, fileId: FILE_ID, campusId: DEFAULT_CAMPUS_ID_A },
        author,
      ),
    ).rejects.toThrow("File must be available to be attached to a post");

    fileRepository.findById.mockResolvedValue(
      createFile({ campusId: DEFAULT_CAMPUS_ID_B }),
    );
    await expect(
      useCase.execute(
        { postId: POST_ID, fileId: FILE_ID, campusId: DEFAULT_CAMPUS_ID_A },
        author,
      ),
    ).rejects.toThrow("File must belong to the same campus as the post");
  });

  it("keeps reorder as a complete, contiguous, zero-based contract", async () => {
    const attachments = [
      createAttachment(ATTACHMENT_ID_A, 0),
      createAttachment(ATTACHMENT_ID_B, 1),
    ];
    postRepository.findById.mockResolvedValue(createPost(PostStatus.DRAFT));
    attachmentRepository.findByPostId.mockResolvedValue(attachments);
    const useCase = new ReorderAttachmentsUseCase(
      attachmentRepository,
      postRepository,
    );

    await expect(
      useCase.execute(
        {
          postId: POST_ID,
          campusId: DEFAULT_CAMPUS_ID_A,
          orders: [{ id: ATTACHMENT_ID_A, order: 0 }],
        },
        author,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        currentOrders: [
          { id: ATTACHMENT_ID_A, order: 0 },
          { id: ATTACHMENT_ID_B, order: 1 },
        ],
      }),
    });

    await expect(
      useCase.execute(
        {
          postId: POST_ID,
          campusId: DEFAULT_CAMPUS_ID_A,
          orders: [
            { id: ATTACHMENT_ID_A, order: 1 },
            { id: ATTACHMENT_ID_B, order: 2 },
          ],
        },
        author,
      ),
    ).rejects.toThrow("Attachment orders must be contiguous and zero-based.");
    expect(attachmentRepository.updateOrder).not.toHaveBeenCalled();
  });

  it("returns the resulting post state after reorder demotes a published post", async () => {
    const published = createPost(PostStatus.PUBLISHED);
    const demoted = createPost(PostStatus.DRAFT);
    postRepository.findById
      .mockResolvedValueOnce(published)
      .mockResolvedValueOnce(demoted);
    attachmentRepository.findByPostId.mockResolvedValue([
      createAttachment(ATTACHMENT_ID_A, 0),
      createAttachment(ATTACHMENT_ID_B, 1),
    ]);

    const result = await new ReorderAttachmentsUseCase(
      attachmentRepository,
      postRepository,
    ).execute(
      {
        postId: POST_ID,
        campusId: DEFAULT_CAMPUS_ID_A,
        orders: [
          { id: ATTACHMENT_ID_B, order: 0 },
          { id: ATTACHMENT_ID_A, order: 1 },
        ],
      },
      author,
    );

    expect(result).toBe(demoted);
    expect(result.status).toBe(PostStatus.DRAFT);
    expect(postRepository.findById).toHaveBeenCalledTimes(2);
  });

  it("returns current orders when the attachment set races after validation", async () => {
    const attachments = [
      createAttachment(ATTACHMENT_ID_A, 0),
      createAttachment(ATTACHMENT_ID_B, 1),
    ];
    postRepository.findById.mockResolvedValue(createPost(PostStatus.DRAFT));
    attachmentRepository.findByPostId.mockResolvedValue(attachments);
    attachmentRepository.updateOrder.mockRejectedValue(
      new AttachmentOrderConflictError([
        { id: ATTACHMENT_ID_A, order: 0 },
        { id: ATTACHMENT_ID_B, order: 1 },
      ]),
    );

    await expect(
      new ReorderAttachmentsUseCase(
        attachmentRepository,
        postRepository,
      ).execute(
        {
          postId: POST_ID,
          campusId: DEFAULT_CAMPUS_ID_A,
          orders: [
            { id: ATTACHMENT_ID_B, order: 0 },
            { id: ATTACHMENT_ID_A, order: 1 },
          ],
        },
        author,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        currentOrders: [
          { id: ATTACHMENT_ID_A, order: 0 },
          { id: ATTACHMENT_ID_B, order: 1 },
        ],
      }),
    });
  });
});
