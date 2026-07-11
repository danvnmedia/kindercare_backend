import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { PostCategory } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";
import { ReorderPostCategoriesUseCase } from "./reorder-post-categories.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const CATEGORY_ID_1 = "22222222-2222-4222-a222-222222222222";
const CATEGORY_ID_2 = "33333333-3333-4333-a333-333333333333";

function category(id: string, order: number): PostCategory {
  return PostCategory.create(
    { campusId: CAMPUS_ID, name: `Category ${order}`, color: "#3B82F6", order },
    id,
  );
}

describe("ReorderPostCategoriesUseCase", () => {
  let tx: jest.Mocked<TransactionContext>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let useCase: ReorderPostCategoriesUseCase;
  const actor = {
    id: "actor-1",
    profile: { fullName: "CMS Manager" },
  } as unknown as User;

  beforeEach(() => {
    tx = {
      lockPostCategoryCampus: jest.fn().mockResolvedValue(undefined),
      findActivePostCategoriesForUpdate: jest
        .fn()
        .mockResolvedValue([
          category(CATEGORY_ID_1, 1),
          category(CATEGORY_ID_2, 2),
        ]),
      reorderPostCategories: jest
        .fn()
        .mockResolvedValue([
          category(CATEGORY_ID_2, 1),
          category(CATEGORY_ID_1, 2),
        ]),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(tx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    useCase = new ReorderPostCategoriesUseCase(unitOfWork);
  });

  it("locks, validates, reorders, and audits in one transaction", async () => {
    const result = await useCase.execute(
      { campusId: CAMPUS_ID, ids: [CATEGORY_ID_2, CATEGORY_ID_1] },
      actor,
    );

    expect(result.map((item) => item.id.toString())).toEqual([
      CATEGORY_ID_2,
      CATEGORY_ID_1,
    ]);
    expect(tx.lockPostCategoryCampus).toHaveBeenCalledWith(CAMPUS_ID);
    expect(tx.findActivePostCategoriesForUpdate).toHaveBeenCalledWith(
      CAMPUS_ID,
    );
    expect(tx.reorderPostCategories).toHaveBeenCalledWith(CAMPUS_ID, [
      CATEGORY_ID_2,
      CATEGORY_ID_1,
    ]);
    expect(tx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeValue: { ids: [CATEGORY_ID_1, CATEGORY_ID_2] },
        afterValue: { ids: [CATEGORY_ID_2, CATEGORY_ID_1] },
      }),
    );
  });

  it("rejects duplicate IDs before opening a transaction", async () => {
    await expect(
      useCase.execute(
        { campusId: CAMPUS_ID, ids: [CATEGORY_ID_1, CATEGORY_ID_1] },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("rejects partial active sets after acquiring the campus lock", async () => {
    await expect(
      useCase.execute({ campusId: CAMPUS_ID, ids: [CATEGORY_ID_1] }, actor),
    ).rejects.toThrow(ConflictException);
    expect(tx.reorderPostCategories).not.toHaveBeenCalled();
    expect(tx.recordAudit).not.toHaveBeenCalled();
  });

  it("maps a transaction serialization conflict", async () => {
    tx.reorderPostCategories.mockRejectedValue({ code: "P2034" });

    await expect(
      useCase.execute(
        { campusId: CAMPUS_ID, ids: [CATEGORY_ID_2, CATEGORY_ID_1] },
        actor,
      ),
    ).rejects.toThrow(
      "Post category order changed during reorder; refresh and retry",
    );
  });
});
