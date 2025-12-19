/**
 * Identity Port
 *
 * Provides identity management abstraction for use cases.
 * Follows Clean Architecture - application layer defines the contract,
 * infrastructure layer provides the implementation (e.g., Clerk).
 */

/**
 * Input for provisioning a new identity
 */
export interface ProvisionIdentityInput {
  externalId?: string;
  email?: string;
  password?: string;
  phoneNumber?: string;
  fullName?: string;
}

/**
 * Result of provisioning a new identity
 */
export interface ProvisionIdentityResult {
  clerkUid: string;
}

/**
 * Input for updating an existing identity
 */
export interface UpdateIdentityInput {
  email?: string;
  password?: string;
  phoneNumber?: string;
  fullName?: string;
  externalId?: string;
}

/**
 * Identity Port - Abstract class for identity management
 *
 * Implementations must handle user identity operations such as
 * creation, update, and deletion of identity accounts.
 */
export abstract class IdentityPort {
  /**
   * Provision a new identity account
   * @param input - Identity provisioning data
   * @returns Result containing the identity UID
   */
  abstract provisionUser(
    input: ProvisionIdentityInput,
  ): Promise<ProvisionIdentityResult>;

  /**
   * Update an existing identity account
   * @param identityUid - The identity UID to update
   * @param updates - Fields to update
   */
  abstract updateUser(
    identityUid: string,
    updates: UpdateIdentityInput,
  ): Promise<void>;

  /**
   * Delete an identity account
   * @param identityUid - The identity UID to delete
   */
  abstract deleteIdentity(identityUid: string): Promise<void>;

  /**
   * Send an invitation email to a user
   * @param email - Email address to send invitation to
   */
  abstract inviteUser(email: string): Promise<void>;
}
