/**
 * Base class for Value Objects in Domain-Driven Design.
 * Value Objects are immutable and compared by their properties rather than identity.
 */
export abstract class ValueObject<T> {
  protected readonly props: T;

  protected constructor(props: T) {
    this.props = Object.freeze(props);
  }

  /**
   * Compare two Value Objects for equality based on their properties.
   */
  public equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }

    if (vo.props === undefined) {
      return false;
    }

    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }

  /**
   * Get the raw properties of the Value Object.
   */
  public get value(): T {
    return this.props;
  }

  /**
   * Convert the Value Object to a plain object for serialization.
   * Override this method in subclasses for custom serialization.
   */
  public toPlain(): T | Record<string, unknown> {
    if (typeof this.props === 'object' && this.props !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(this.props as object)) {
        if (value instanceof ValueObject) {
          result[key] = value.toPlain();
        } else {
          result[key] = value;
        }
      }
      return result;
    }
    return this.props;
  }

  /**
   * Convert the Value Object to a string representation.
   */
  public toString(): string {
    if (typeof this.props === 'string') {
      return this.props;
    }
    return JSON.stringify(this.props);
  }
}
