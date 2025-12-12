import { Post } from "@/domain/content-management";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class PostRepository {
  abstract create(post: Post): Promise<Post>;
  abstract update(id: string, data: Post): Promise<Post>;
  abstract delete(id: string): Promise<void>;
  abstract findById(id: string): Promise<Post | null>;
  abstract findMany(query: StandardRequestDto): Promise<PaginatedResult<Post>>;
}
