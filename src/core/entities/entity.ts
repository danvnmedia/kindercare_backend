import { UniqueEntityID } from "./unique-entity-id";

export abstract class Entity<Props> {
  protected props: Props;
  protected _id: UniqueEntityID;

  protected constructor(props: Props, id?: UniqueEntityID) {
    this.props = props;
    this._id = id ?? new UniqueEntityID();
  }

  get id(): string {
    return this._id.toString();
  }

  /**
   * Converts the entity to a plain object for serialization
   * @returns Plain object representation of the entity
   */
  public toPlain(): Record<string, any> {
    const plainObject: Record<string, any> = {
      id: this.id,
    };

    // Convert all properties
    const propsObject = this.props as Record<string, any>;
    for (const key in propsObject) {
      if (Object.prototype.hasOwnProperty.call(propsObject, key)) {
        const value = propsObject[key];

        // Handle nested ValueObjects or Entities
        if (
          value &&
          typeof value === "object" &&
          "toPlain" in value &&
          typeof value.toPlain === "function"
        ) {
          plainObject[key] = value.toPlain();
        } else if (Array.isArray(value)) {
          // Handle arrays of ValueObjects or Entities
          plainObject[key] = value.map((item) =>
            item &&
            typeof item === "object" &&
            "toPlain" in item &&
            typeof item.toPlain === "function"
              ? item.toPlain()
              : item,
          );
        } else {
          plainObject[key] = value;
        }
      }
    }

    return plainObject;
  }
}
