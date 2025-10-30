import { User } from '@/domain/user-management';
import { PaginatedResult, StandardRequest } from '@/core/modules/standard-response';

export interface UserRepository {
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    findAll(): Promise<User[]>;
    findManyWithPagination(params: StandardRequest): Promise<PaginatedResult<User>>;
    save(user: User): Promise<void>;
    delete(id: string): Promise<void>;
}