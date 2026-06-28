import { PostHistoryStatus } from "@/domain/content-management/entities/post-history-status.entity";

export abstract class PostHistoryStatusRepository {
  abstract create(
    postHistoryStatus: PostHistoryStatus,
  ): Promise<PostHistoryStatus>;
  abstract findByPostId(postId: string): Promise<PostHistoryStatus[]>;
}
