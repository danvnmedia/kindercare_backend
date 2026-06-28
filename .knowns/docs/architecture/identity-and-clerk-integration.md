---
title: Identity and Clerk Integration
description: Hexagonal port + adapter pattern for Clerk identity. Provisioning, updating, locking, and deleting Clerk users with primary-email/phone replacement.
createdAt: '2026-05-05T17:50:44.988Z'
updatedAt: '2026-05-05T17:50:44.988Z'
tags:
  - architecture
  - clerk
  - identity
  - authentication
  - external-services
  - ports-adapters
---

# Identity and Clerk Integration

> Clerk handles authentication and identity. The application interacts with Clerk through a **port + adapter** so the domain stays unaware of any specific provider. Source under `src/application/ports/identity.port.ts` and `src/infra/external-services/clerk/`.

The authentication side (token verification) is documented separately in [@doc/architecture/adr-hybrid-authentication-context-architecture](architecture/adr-hybrid-authentication-context-architecture). This doc focuses on **identity management** — creating, updating, locking, and deleting Clerk users.

## Two Ports

```
src/application/ports/
├── identity.port.ts            # IdentityPort — full lifecycle of Clerk users
└── authentication.port.ts      # AuthenticationPort — verify a token at request time
```

| Port | Responsibility | Bound to |
|------|----------------|----------|
| `IdentityPort` | Provision, update, delete, lock, unlock, invite | `IdentityService` (Clerk SDK) |
| `AuthenticationPort` | Verify the request's bearer token | `ClerkAuthenticationAdapter` |

Both adapters live in `ClerkModule` (`src/infra/external-services/clerk/clerk.module.ts`):

```typescript
providers: [
  ClerkClientProvider,                                          // wraps @clerk/backend
  { provide: IdentityPort, useClass: IdentityService },          // abstract class binding
  { provide: "AUTHENTICATION_PORT", useClass: ClerkAuthenticationAdapter }, // string token
],
exports: [IdentityPort, "AUTHENTICATION_PORT"],
```

`IdentityPort` is bound by class (use cases inject `IdentityPort` directly with no `@Inject`); `AuthenticationPort` uses a string token (`@Inject("AUTHENTICATION_PORT")`) — historical inconsistency.

## `IdentityPort` Surface

```typescript
export abstract class IdentityPort {
  abstract provisionUser(input: ProvisionIdentityInput): Promise<ProvisionIdentityResult>;
  abstract updateUser(identityUid: string, updates: UpdateIdentityInput): Promise<void>;
  abstract deleteIdentity(identityUid: string): Promise<void>;
  abstract inviteUser(email: string): Promise<void>;
  abstract lockIdentity(identityUid: string): Promise<void>;     // prevents sign-in
  abstract unlockIdentity(identityUid: string): Promise<void>;   // re-enables sign-in
}
```

Inputs:

```typescript
export interface ProvisionIdentityInput {
  externalId?: string;
  email?: string;
  password?: string;
  phoneNumber?: string;
  fullName?: string;
}

export interface UpdateIdentityInput {
  email?: string;
  password?: string;
  phoneNumber?: string;
  fullName?: string;
  externalId?: string;
}
```

The contract is intentionally narrow — anything specific to Clerk (email verification flags, primary-email selection) is hidden inside the adapter.

## `IdentityService` — the Clerk Adapter

`src/infra/external-services/clerk/identity.service.ts`. Notable behaviours:

### Pre-flight uniqueness on `provisionUser`

Clerk's `users.createUser` doesn't surface a clean "already exists" error, so the adapter checks first:

```typescript
const byEmail = await this.clerkClient.users.getUserList({ emailAddress: [input.email] });
if (byEmail.totalCount > 0) throw new ConflictException("Email already exists");
```

Same for phone. This duplicates the DB-level uniqueness check (which lives in the use case) but catches Clerk-side conflicts.

### Email/phone replacement (`updateUser`)

Clerk treats email addresses as **separate sub-resources**: a user has zero or more `emailAddresses`, one of which is `primary`. Updating a user's email is a multi-step dance:

1. Look for an existing email row with the new address. If absent, create one.
2. Mark the new email as `verified: true` (we trust our DB-side validation).
3. Set the user's `primaryEmailAddressID` to the new email's ID.
4. Delete every other email row.

`replacePrimaryEmail` and `replacePrimaryPhone` (private helpers) implement this for emails and phone numbers respectively. The dance ensures the user has exactly one email/phone after the update.

### `lockIdentity` / `unlockIdentity`

Soft-deactivation. The user's account is preserved on Clerk but they can't sign in. Used by the archive saga (see [@doc/patterns/saga-pattern](patterns/saga-pattern)). Called best-effort — failure is logged but doesn't throw.

### `deleteIdentity`

Hard delete on Clerk. Used by `DeleteGuardianUseCase`/`DeleteStaffUseCase` and by saga compensation when DB writes fail after `provisionUser`.

## `ClerkAuthenticationAdapter`

`src/infra/external-services/clerk/clerk-authentication.adapter.ts` (not shown above). Implements `AuthenticationPort.verifyAuthentication(request)`:

1. Extract the bearer token from `Authorization: Bearer …`.
2. Call Clerk's `authenticateRequest` with the token.
3. Return `{ isAuthenticated, userId, sessionId, error? }`.

Used only by `AuthMiddleware`. Guards never call this directly.

## `ClerkClient` Provider

```typescript
// clerk-client.provider.ts (sketch)
export const ClerkClientProvider: Provider = {
  provide: "ClerkClient",
  useFactory: (config: ConfigService) =>
    createClerkClient({ secretKey: config.getOrThrow("CLERK_SECRET_KEY") }),
  inject: [ConfigService],
};
```

Both adapters inject `ClerkClient` (the typed `@clerk/backend` client). The provider runs once at boot and is memoised by NestJS.

## How Use Cases Use the Identity Port

```typescript
// CreateStaffUseCase
const clerkUser = await this.identityPort.provisionUser({
  email: input.email,
  fullName: input.fullName,
  phoneNumber: input.phoneNumber,
  password: DEFAULT_WEAK_PASSWORD,
});

await this.unitOfWork.run(async (tx) => {
  const user = await tx.createUser({ clerkUid: clerkUser.clerkUid, isActive: true });
  // …
});
```

The forward call sits **outside** the UoW; if the DB transaction fails, the saga compensation calls `identityPort.deleteIdentity(clerkUser.clerkUid)`. See [@doc/patterns/saga-pattern](patterns/saga-pattern).

For updates with field-by-field revert, see `UpdateGuardianUseCase` — it captures original values, calls `identityPort.updateUser`, and reverts on DB failure.

## User ↔ Identity Mapping

| Domain | Storage | Source |
|--------|---------|--------|
| `User.id` | DB UUID | generated when the row is created |
| `User.clerkUid` | `clerk_uid` column, unique | Clerk's user ID, e.g. `user_2abc…` |
| `User.isActive` | local flag | toggled by archive/restore use cases |

The Clerk side stores no profile information beyond email/phone/fullName. All app-level data (campus, roles, classes, etc.) lives in our DB. This separation means we can swap providers (Auth0, Firebase, Supabase) by reimplementing `IdentityPort` and `AuthenticationPort`.

## Replaceability Test

If you want to verify the abstraction holds, create a `MemoryIdentityService` for tests that:

- Returns deterministic UIDs.
- Stores user data in a `Map`.
- Implements all six methods.

Bind it in the test module's `ClerkModule` mock; no use case should need changes. The `test-utils` folder has the building blocks for this kind of test (see [@doc/patterns/testing-pattern](patterns/testing-pattern)).

## Pitfalls

| Mistake | Symptom |
|---------|---------|
| Calling `clerkClient` directly from a use case | Bypasses the port; locks code to Clerk |
| Throwing inside the adapter for "already locked" / "already deleted" | Compensation needs idempotency; convert to no-op + log |
| Letting the adapter return Clerk-specific types | `IdentityPort` consumers shouldn't need `@clerk/backend` types |
| Reading `clerkUid` from the request body | The trusted source is `RequestContext.clerkId` (set by `AuthMiddleware`) |
| Storing email/phone only in Clerk | We mirror them in `Guardian`/`Staff` for campus-scoped uniqueness — keep them in sync via `updateUser` |
| Forgetting to verify the new email | `updateEmailAddress({ verified: true })` is required, otherwise Clerk treats the email as untrusted |

## Reference

| File | Notes |
|------|-------|
| `src/application/ports/identity.port.ts` | Port surface |
| `src/application/ports/authentication.port.ts` | Token verification port |
| `src/infra/external-services/clerk/identity.service.ts` | Provisioning + email/phone replacement dance |
| `src/infra/external-services/clerk/clerk-authentication.adapter.ts` | Token verification adapter |
| `src/infra/external-services/clerk/clerk.module.ts` | Bindings |
| `src/application/user-management/use-cases/staff/create-staff.use-case.ts` | Saga consumer |
| `src/application/user-management/use-cases/guardian/update-guardian.use-case.ts` | Field-level update + revert |
