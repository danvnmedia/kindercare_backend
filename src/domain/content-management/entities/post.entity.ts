import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { PostStatus } from "../enums/post-status.enum";
import { PostType } from "../enums/post-type.enum";
import { PostAudience } from "./post-audience.entity";
import { Attachment } from "./attachment.entity";
import { User } from "@/domain/user-management/user.entity";

export interface PostProps {
  authorId: UniqueEntityID;
  author: User;
  type: PostType;
  title: string;
  content?: string | null;
  status: PostStatus;
  publishAt?: Date | null;
  audiences: PostAudience[];
  attachments: Attachment[];
  createdAt: Date;
  updatedAt?: Date | null;
}

export class Post extends Entity<PostProps> {
  protected props: PostProps;

  private constructor(props: PostProps, id?: UniqueEntityID) {
    super(id);
    this.props = props;
  }

  get authorId(): UniqueEntityID {
    return this.props.authorId;
  }

  get author(): User {
    return this.props.author;
  }

  get type(): PostType {
    return this.props.type;
  }

  set type(type: PostType) {
    this.props.type = type;
    this.props.updatedAt = new Date();
  }

  get title(): string {
    return this.props.title;
  }

  set title(title: string) {
    this.props.title = title;
    this.props.updatedAt = new Date();
  }

  get content(): string | null | undefined {
    return this.props.content;
  }

  set content(content: string | null | undefined) {
    this.props.content = content;
    this.props.updatedAt = new Date();
  }

  get status(): PostStatus {
    return this.props.status;
  }

  set status(status: PostStatus) {
    this.props.status = status;
    this.props.updatedAt = new Date();
  }

  get publishAt(): Date | null | undefined {
    return this.props.publishAt;
  }

  set publishAt(publishAt: Date | null | undefined) {
    this.props.publishAt = publishAt;
    this.props.updatedAt = new Date();
  }

  get audiences(): PostAudience[] {
    return this.props.audiences;
  }

  set audiences(audiences: PostAudience[]) {
    this.props.audiences = audiences;
    this.props.updatedAt = new Date();
  }

  get attachments(): Attachment[] {
    return this.props.attachments;
  }

  set attachments(attachments: Attachment[]) {
    this.props.attachments = attachments;
    this.props.updatedAt = new Date();
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date | null | undefined {
    return this.props.updatedAt;
  }

  static create(
    props: Optional<
      PostProps,
      | "createdAt"
      | "status"
      | "audiences"
      | "attachments"
      | "content"
      | "publishAt"
      | "updatedAt"
    >,
    id?: UniqueEntityID,
  ): Post {
    const postProps: PostProps = {
      author: props.author, // Ensure author is always present during creation
      authorId: props.authorId,
      type: props.type,
      title: props.title,
      content: props.content ?? null,
      publishAt: props.publishAt ?? null,
      status: props.status ?? PostStatus.DRAFT,
      audiences: props.audiences ?? [],
      attachments: props.attachments ?? [],
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? null,
    };

    const post = new Post(postProps, id);

    return post;
  }
}
