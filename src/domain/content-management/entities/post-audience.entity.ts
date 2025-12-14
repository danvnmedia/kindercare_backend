import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { AudienceType } from "../enums/audience-type.enum";

export interface PostAudienceProps {
  postId: string;
  audienceType: AudienceType;
  audienceId: string;
}

export class PostAudience extends Entity<PostAudienceProps> {
  get postId() {
    return this.props.postId;
  }

  get audienceType() {
    return this.props.audienceType;
  }

  get audienceId() {
    return this.props.audienceId;
  }

  static create(props: PostAudienceProps, id?: string): PostAudience {
    return new PostAudience(props, new UniqueEntityID(id));
  }
}
