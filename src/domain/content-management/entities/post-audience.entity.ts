import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { AudienceType } from "../enums/audience-type.enum";

export interface PostAudienceProps {
  postId: UniqueEntityID;
  audienceType: AudienceType;
  audienceId: UniqueEntityID;
}

export class PostAudience extends Entity<PostAudienceProps> {
  protected props: PostAudienceProps;

  private constructor(props: PostAudienceProps, id?: UniqueEntityID) {
    super(id);
    this.props = props;
  }

  get postId() {
    return this.props.postId;
  }

  get audienceType() {
    return this.props.audienceType;
  }

  get audienceId() {
    return this.props.audienceId;
  }

  static create(props: PostAudienceProps, id?: UniqueEntityID): PostAudience {
    const postAudience = new PostAudience(props, id);
    return postAudience;
  }
}
