import { UniqueEntityID } from "./unique-entity-id";

export abstract class Entity<T = any> {
  protected readonly _id: UniqueEntityID;

  protected constructor(id?: UniqueEntityID) {
    this._id = id ?? new UniqueEntityID();
  }

  get id(): string {
    return this._id.toString();
  }

  get entityId(): UniqueEntityID {
    return this._id;
  }

  public equals(object?: Entity<T>): boolean {
    if (object === null || object === undefined) {
      return false;
    }

    if (this === object) {
      return true;
    }

    if (!(object instanceof Entity)) {
      return false;
    }

    return this._id.equals(object._id);
  }
}
