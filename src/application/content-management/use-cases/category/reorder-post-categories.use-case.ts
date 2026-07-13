import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { PostCategory } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";

export interface ReorderPostCategoriesInput {
  campusId: string;
  ids: string[];
}

@Injectable()
export class ReorderPostCategoriesUseCase {
  private readonly logger = new Logger(ReorderPostCategoriesUseCase.name);

  constructor(private readonly unitOfWork: UnitOfWorkPort) {}

  async execute(
    input: ReorderPostCategoriesInput,
    currentUser: User,
  ): Promise<PostCategory[]> {
    this.logger.log(`Reordering ${input.ids.length} post categories`);
    if (input.ids.length === 0) {
      throw new BadRequestException(
        "At least one post category ID is required",
      );
    }
    if (new Set(input.ids).size !== input.ids.length) {
      throw new BadRequestException("Post category IDs must be unique");
    }

    try {
      const reordered = await this.unitOfWork.run(async (tx) => {
        await tx.lockPostCategoryCampus(input.campusId);
        const active = await tx.findActivePostCategoriesForUpdate(
          input.campusId,
        );
        const activeIds = active.map((category) => category.id.toString());
        if (!this.hasSameIds(input.ids, activeIds)) {
          throw new ConflictException(
            "Post category order is stale; refresh the active categories and retry",
          );
        }

        const saved = await tx.reorderPostCategories(input.campusId, input.ids);
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "REORDER_POST_CATEGORIES",
          targetType: "post_category",
          targetId: input.ids[0],
          campusId: input.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            orderedIds: input.ids,
          },
          beforeValue: { ids: activeIds },
          afterValue: { ids: input.ids },
        });
        return saved;
      });

      this.logger.log(`Successfully reordered ${reordered.length} categories`);
      return reordered;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      if (this.isTransactionConflict(error)) {
        throw new ConflictException(
          "Post category order changed during reorder; refresh and retry",
        );
      }
      throw error;
    }
  }

  private hasSameIds(left: string[], right: string[]): boolean {
    if (left.length !== right.length) return false;
    const rightIds = new Set(right);
    return left.every((id) => rightIds.has(id));
  }

  private isTransactionConflict(error: unknown): boolean {
    if (
      error instanceof Error &&
      error.message.includes("active set changed")
    ) {
      return true;
    }
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      ["P2034", "55P03"].includes(String((error as { code?: unknown }).code))
    );
  }
}
