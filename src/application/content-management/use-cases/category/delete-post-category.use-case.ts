import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { PostCategory } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";

@Injectable()
export class DeletePostCategoryUseCase {
  private readonly logger = new Logger(DeletePostCategoryUseCase.name);

  constructor(private readonly unitOfWork: UnitOfWorkPort) {}

  async execute(
    id: string,
    campusId: string,
    currentUser: User,
  ): Promise<PostCategory> {
    this.logger.log(`Archiving post category: ${id}`);

    const archivedCategory = await this.unitOfWork.run(async (tx) => {
      await tx.lockPostCategoryCampus(campusId);
      const category = await tx.findPostCategoryByIdForUpdate(id);
      if (!category || category.campusId !== campusId) {
        throw new NotFoundException(
          `Post category with ID ${id} not found in this campus`,
        );
      }

      const beforeValue = this.toAuditSnapshot(category);
      category.archive();
      const saved = await tx.updatePostCategory(category);
      const active = await tx.findActivePostCategoriesForUpdate(campusId);
      if (active.length > 0) {
        await tx.reorderPostCategories(
          campusId,
          active.map((item) => item.id.toString()),
        );
      }

      await tx.recordAudit({
        actorId: currentUser.id,
        action: "DELETE_POST_CATEGORY",
        targetType: "post_category",
        targetId: saved.id.toString(),
        campusId,
        context: {
          actorName: currentUser.profile?.fullName ?? null,
          targetName: saved.name,
        },
        beforeValue,
        afterValue: this.toAuditSnapshot(saved),
      });
      return saved;
    });

    this.logger.log(`Post category archived successfully: ${id}`);
    return archivedCategory;
  }

  private toAuditSnapshot(category: PostCategory): Record<string, unknown> {
    return {
      name: category.name,
      color: category.color,
      icon: category.icon,
      order: category.order,
      isArchived: category.isArchived,
    };
  }
}
