import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";

/**
 * Properties of the PostReaction entity.
 * Reactions are simple heart likes - one per user per post.
 */
export interface PostReactionProps {
  postId: string;
  userId: string;
  createdAt: Date;
}

/**
 * PostReaction entity represents a heart reaction on a post.
 * This is a simple entity - reactions can only be created or deleted (toggled).
 * Each user can only have one reaction per post.
 */
export class PostReaction extends Entity<PostReactionProps> {
  // --- Getters ---

  get postId(): string {
    return this.props.postId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  // --- Factory Method ---

  /**
   * Creates a new PostReaction entity.
   * @param props - The properties of the reaction.
   * @param id - An optional ID.
   * @returns A new PostReaction instance.
   */
  public static create(
    props: Optional<PostReactionProps, "createdAt">,
    id?: string,
  ): PostReaction {
    // Validation
    if (!props.postId) {
      throw new Error("Post ID is required for reaction");
    }

    if (!props.userId) {
      throw new Error("User ID is required for reaction");
    }

    const reactionProps: PostReactionProps = {
      postId: props.postId,
      userId: props.userId,
      createdAt: props.createdAt ?? new Date(),
    };

    return new PostReaction(
      reactionProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
