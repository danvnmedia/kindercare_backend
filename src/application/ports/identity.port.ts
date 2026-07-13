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
 * Minimal identity lookup result used to classify safe attach vs provider-only
 * conflicts without exposing provider profile data to staff flows.
 */
export interface IdentityLookupResult {
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
   * Find identity-provider users by email address.
   */
  abstract findIdentitiesByEmail(
    email: string,
  ): Promise<IdentityLookupResult[]>;

  /**
   * Find identity-provider users by phone number.
   */
  abstract findIdentitiesByPhoneNumber(
    phoneNumber: string,
  ): Promise<IdentityLookupResult[]>;

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

  /**
   * Lock an identity account (prevents sign-in)
   * Used for soft delete - account can be unlocked later
   * @param identityUid - The identity UID to lock
   */
  abstract lockIdentity(identityUid: string): Promise<void>;

  /**
   * Unlock an identity account (allows sign-in again)
   * Used to restore a soft-deleted account
   * @param identityUid - The identity UID to unlock
   */
  abstract unlockIdentity(identityUid: string): Promise<void>;
}
