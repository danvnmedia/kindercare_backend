import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { PostCategory } from "@/domain/content-management";
import { PostCategoryRepository } from "../../ports/post-category.repository";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";

@Injectable()
export class DeletePostCategoryUseCase {
  private readonly logger = new Logger(DeletePostCategoryUseCase.name);

  constructor(
    @Inject("POST_CATEGORY_REPOSITORY")
    private readonly postCategoryRepository: PostCategoryRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    id: string,
    campusId: string,
    currentUser: User,
  ): Promise<PostCategory> {
    this.logger.log(`Archiving post category: ${id}`);

    // Step 1: Check existence
    const category = await this.postCategoryRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Post category with ID ${id} not found`);
    }

    // Step 2: Verify category belongs to the specified campus (if campusId provided)
    if (campusId && category.campusId !== campusId) {
      throw new NotFoundException(
        `Post category with ID ${id} not found in this campus`,
      );
    }

    // Step 3: Archive (soft delete) via domain method
    category.archive();

    // Step 4: Save to repository
    const archivedCategory = await this.unitOfWork.run(async (tx) => {
      const saved = await tx.updatePostCategory(category);
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
        beforeValue: {
          name: category.name,
          isArchived: false,
        },
        afterValue: {
          name: saved.name,
          isArchived: saved.isArchived,
        },
      });
      return saved;
    });
    this.logger.log(`Post category archived successfully: ${id}`);

    return archivedCategory;
  }
}
