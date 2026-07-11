import { ForbiddenException } from "@nestjs/common";
import { PostCategoryRepository } from "../../ports/post-category.repository";
import { User } from "@/domain/user-management/user.entity";
import { GetAllPostCategoriesUseCase } from "./get-all-post-categories.use-case";

function userWithPermissions(...permissionIds: string[]): User {
  return {
    getGlobalRoles: () => [],
    getRolesForCampus: () => [
      {
        permissions: permissionIds.map((id) => ({ id })),
      },
    ],
  } as unknown as User;
}

describe("GetAllPostCategoriesUseCase", () => {
  let repository: jest.Mocked<PostCategoryRepository>;
  let useCase: GetAllPostCategoriesUseCase;

  beforeEach(() => {
    repository = {
      findByCampusId: jest.fn().mockResolvedValue({
        data: [],
        pagination: {
          count: 0,
          limit: 50,
          offset: 0,
          totalPages: 0,
          currentPage: 1,
          hasNext: false,
          hasPrev: false,
        },
      }),
    } as unknown as jest.Mocked<PostCategoryRepository>;
    useCase = new GetAllPostCategoriesUseCase(repository);
  });

  it.each(["post.create", "post.list"])(
    "allows %s to read active categories only",
    async (permission) => {
      await useCase.execute(
        "campus-1",
        {
          filterInfo: { filters: { isActive: false } },
        },
        userWithPermissions(permission),
      );

      expect(repository.findByCampusId).toHaveBeenCalledWith(
        "campus-1",
        expect.objectContaining({
          filterInfo: {
            filters: { isArchived: false },
          },
        }),
      );
    },
  );

  it("allows post.manage to read archived categories", async () => {
    await useCase.execute(
      "campus-1",
      {
        filterInfo: { filters: { isActive: false } },
      },
      userWithPermissions("post.manage"),
    );

    expect(repository.findByCampusId).toHaveBeenCalledWith(
      "campus-1",
      expect.objectContaining({
        filterInfo: {
          filters: { isArchived: true },
        },
      }),
    );
  });

  it("rejects users without category read permissions", async () => {
    await expect(
      useCase.execute("campus-1", {}, userWithPermissions("post.read")),
    ).rejects.toThrow(ForbiddenException);

    expect(repository.findByCampusId).not.toHaveBeenCalled();
  });
});
