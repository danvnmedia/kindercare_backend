import { v4 as uuid } from 'uuid';

export class UniqueEntityID {
    private _value: string;

    constructor(id?: string) {
        this._value = id ?? uuid();
    }

    equals(id?: UniqueEntityID): boolean {
        if (id === null || id === undefined) {
            return false;
        }

        if (!(id instanceof UniqueEntityID)) {
            return false;
        }

        return id.toString() === this._value;
    }

    toString(): string {
        return this._value;
    }
}