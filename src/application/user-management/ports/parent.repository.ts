/**
 * Parent Repository Port (Interface)
 * Defines the contract for parent data access
 * Implementation will be provided by infrastructure layer
 */

import { Parent } from '../../../domain/user-management/parent.entity';
import { StandardRequest } from '@/core/modules/standard-response/dto/standard-request.dto';
import { PaginatedResult } from '@/core/modules/standard-response/dto/query.dto';

export interface ParentRepository {
  /**
   * Find parent by ID
   */
  findById(id: string): Promise<Parent | null>;

  /**
   * Find parent by email
   */
  findByEmail(email: string): Promise<Parent | null>;

  /**
   * Find parent by phone number
   */
  findByPhoneNumber(phoneNumber: string): Promise<Parent | null>;

  /**
   * Find all parents with filtering, sorting, pagination using StandardRequest
   */
  findAll(params: StandardRequest): Promise<PaginatedResult<Parent>>;

  /**
   * Find multiple parents by IDs
   */
  findByIds(ids: string[]): Promise<Parent[]>;

  /**
   * Save a new parent
   */
  save(parent: Omit<Parent, 'id' | 'createdAt' | 'updatedAt'>): Promise<Parent>;

  /**
   * Update existing parent
   */
  update(id: string, data: Partial<Parent>): Promise<Parent>;

  /**
   * Delete parent
   */
  delete(id: string): Promise<void>;

  /**
   * Get parent's children (students)
   */
  getParentChildren(parentId: string): Promise<any[]>;
}
