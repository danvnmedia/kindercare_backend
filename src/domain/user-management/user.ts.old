import { Entity, UniqueEntityID } from '@/core/entities';

export interface UserProps {
    name: string;
    email: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export class User extends Entity<UserProps> {
    constructor(props: UserProps, id?: UniqueEntityID) {
        super(id);
        this._props = {
            ...props,
            createdAt: props.createdAt ?? new Date(),
            updatedAt: props.updatedAt ?? new Date(),
        };
    }

    private _props: UserProps;

    get name(): string {
        return this._props.name;
    }

    get email(): string {
        return this._props.email;
    }

    get createdAt(): Date {
        return this._props.createdAt!;
    }

    get updatedAt(): Date {
        return this._props.updatedAt!;
    }

    public updateName(name: string): void {
        this._props.name = name;
        this._props.updatedAt = new Date();
    }

    public updateEmail(email: string): void {
        this._props.email = email;
        this._props.updatedAt = new Date();
    }

    public static create(props: UserProps, id?: UniqueEntityID): User {
        return new User(props, id);
    }
}