import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { PostCategory } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";
import { CreatePostCategoryUseCase } from "./create-post-category.use-case";
import { DeletePostCategoryUseCase } from "./delete-post-category.use-case";
import { UpdatePostCategoryUseCase } from "./update-post-category.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-a222-222222222222";
const actor = {
  id: "actor-1",
  profile: { fullName: "CMS Manager" },
} as unknown as User;

function category(
  overrides: Partial<{
    id: string;
    name: string;
    order: number;
    isArchived: boolean;
  }> = {},
): PostCategory {
  return PostCategory.create(
    {
      campusId: CAMPUS_ID,
      name: overrides.name ?? "Announcements",
      color: "#3B82F6",
      icon: "📢",
      order: overrides.order ?? 1,
      isArchived: overrides.isArchived ?? false,
    },
    overrides.id ?? CATEGORY_ID,
  );
}

describe("post category write use cases", () => {
  let tx: jest.Mocked<TransactionContext>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;

  beforeEach(() => {
    tx = {
      lockPostCategoryCampus: jest.fn().mockResolvedValue(undefined),
      findPostCategoryByIdForUpdate: jest.fn(),
      findActivePostCategoriesForUpdate: jest.fn().mockResolvedValue([]),
      findPostCategoryByName: jest.fn().mockResolvedValue(null),
      createPostCategory: jest.fn((value) => Promise.resolve(value)),
      updatePostCategory: jest.fn((value) => Promise.resolve(value)),
      reorderPostCategories: jest.fn(),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(tx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
  });

  it("normalizes and creates under the campus lock with same-tx audit", async () => {
    const useCase = new CreatePostCategoryUseCase(unitOfWork);

    const result = await useCase.execute(
      {
        campusId: CAMPUS_ID,
        name: "  Events  ",
        color: " #3b82f6 ",
        icon: "  🎉  ",
      },
      actor,
    );

    expect(tx.lockPostCategoryCampus).toHaveBeenCalledWith(CAMPUS_ID);
    expect(tx.findPostCategoryByName).toHaveBeenCalledWith(CAMPUS_ID, "Events");
    expect(result).toEqual(
      expect.objectContaining({ name: "Events", color: "#3B82F6", icon: "🎉" }),
    );
    expect(tx.recordAudit).toHaveBeenCalledTimes(1);
  });

  it("inserts at a requested active order using transactional reorder", async () => {
    const first = category();
    tx.findActivePostCategoriesForUpdate.mockResolvedValue([first]);
    tx.reorderPostCategories.mockImplementation(async (_campusId, ids) =>
      ids.map((id, index) =>
        category({
          id,
          name: id === CATEGORY_ID ? "Announcements" : "Events",
          order: index + 1,
        }),
      ),
    );
    const useCase = new CreatePostCategoryUseCase(unitOfWork);

    const result = await useCase.execute(
      { campusId: CAMPUS_ID, name: "Events", color: "#3B82F6", order: 1 },
      actor,
    );

    expect(tx.reorderPostCategories).toHaveBeenCalledWith(
      CAMPUS_ID,
      expect.arrayContaining([CATEGORY_ID, result.id.toString()]),
    );
    expect(tx.reorderPostCategories.mock.calls[0][1][0]).toBe(
      result.id.toString(),
    );
  });

  it("rejects invalid fields before opening a transaction", async () => {
    const useCase = new CreatePostCategoryUseCase(unitOfWork);

    await expect(
      useCase.execute(
        { campusId: CAMPUS_ID, name: "a".repeat(61), color: "#3B82F6" },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("maps a DB-backed duplicate create to conflict", async () => {
    tx.createPostCategory.mockRejectedValue({ code: "P2002" });
    const useCase = new CreatePostCategoryUseCase(unitOfWork);

    await expect(
      useCase.execute(
        { campusId: CAMPUS_ID, name: "Events", color: "#3B82F6" },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it("updates a locked campus category and audits atomically", async () => {
    tx.findPostCategoryByIdForUpdate.mockResolvedValue(category());
    tx.findActivePostCategoriesForUpdate.mockResolvedValue([category()]);
    const useCase = new UpdatePostCategoryUseCase(unitOfWork);

    const result = await useCase.execute(
      CATEGORY_ID,
      { campusId: CAMPUS_ID, name: " Family News ", color: " #22c55e " },
      actor,
    );

    expect(result.name).toBe("Family News");
    expect(result.color).toBe("#22C55E");
    expect(tx.lockPostCategoryCampus).toHaveBeenCalledWith(CAMPUS_ID);
    expect(tx.recordAudit).toHaveBeenCalledTimes(1);
  });

  it("archives and compacts active order in one transaction", async () => {
    const archived = category();
    const remaining = category({
      id: "33333333-3333-4333-a333-333333333333",
      name: "Events",
      order: 2,
    });
    tx.findPostCategoryByIdForUpdate.mockResolvedValue(archived);
    tx.findActivePostCategoriesForUpdate.mockResolvedValue([remaining]);
    tx.reorderPostCategories.mockResolvedValue([remaining]);
    const useCase = new DeletePostCategoryUseCase(unitOfWork);

    const result = await useCase.execute(CATEGORY_ID, CAMPUS_ID, actor);

    expect(result.isArchived).toBe(true);
    expect(tx.reorderPostCategories).toHaveBeenCalledWith(CAMPUS_ID, [
      remaining.id.toString(),
    ]);
    expect(tx.recordAudit).toHaveBeenCalledTimes(1);
  });

  it("does not reveal a cross-campus category during archive", async () => {
    tx.findPostCategoryByIdForUpdate.mockResolvedValue(null);
    const useCase = new DeletePostCategoryUseCase(unitOfWork);

    await expect(
      useCase.execute(CATEGORY_ID, CAMPUS_ID, actor),
    ).rejects.toThrow(NotFoundException);
    expect(tx.updatePostCategory).not.toHaveBeenCalled();
    expect(tx.recordAudit).not.toHaveBeenCalled();
  });
});
