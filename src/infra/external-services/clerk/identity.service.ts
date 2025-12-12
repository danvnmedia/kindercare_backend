import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { type ClerkClient, type User } from "@clerk/backend";
import {
  InvitationInput,
  InvitationResult,
} from "../types/identity/invitations";
import { ProvisionInput } from "../types/identity/provision-input";
import { ProvisionResult } from "../types/identity/provision-result";

@Injectable()
export class IdentityService {
  constructor(
    @Inject("ClerkClient") private readonly clerkClient: ClerkClient,
  ) {}

  async provisionUser(input: ProvisionInput): Promise<ProvisionResult> {
    if (!input.email && !input.phoneNumber) {
      throw new BadRequestException("Either phone number or email is required");
    }

    // Phone number is expected to be in E.164 format already (validated by DTOs)
    if (input.email) {
      const byEmail = await this.clerkClient.users.getUserList({
        emailAddress: [input.email],
      });
      if (byEmail.totalCount > 0) {
        throw new ConflictException("Email already exists");
      }
    }
    if (input.phoneNumber) {
      const byPhone = await this.clerkClient.users.getUserList({
        phoneNumber: [input.phoneNumber],
      });
      if (byPhone.totalCount > 0) {
        throw new ConflictException("Phone number already exists");
      }
    }

    try {
      const created = await this.clerkClient.users.createUser({
        emailAddress: input.email ? [input.email] : undefined,
        phoneNumber: input.phoneNumber ? [input.phoneNumber] : undefined,
        password: input.password,
        skipPasswordChecks: true,
        publicMetadata: { fullName: input.fullName?.trim() ?? "" },
      });
      return { clerkUid: created.id };
    } catch (err) {
      throw new ConflictException("Error when provisioning user: " + err);
    }
  }

  async inviteUser(email: string): Promise<void> {
    try {
      await this.clerkClient.invitations.createInvitation({
        emailAddress: email,
      });
    } catch (err) {
      throw new ConflictException("Error when inviting user: " + err);
    }
  }

  async updateUser(clerkUid: string, updates: ProvisionInput): Promise<void> {
    const user = await this.clerkClient.users.getUser(clerkUid);
    if (updates.email) {
      await this.replacePrimaryEmail(user, updates.email);
    }

    if (updates.phoneNumber) {
      // Phone number is expected to be in E.164 format already (validated by DTOs)
      await this.replacePrimaryPhone(user, updates.phoneNumber);
    }

    if (updates.password) {
      await this.clerkClient.users.updateUser(clerkUid, {
        password: updates.password,
      });
    }

    if (updates.fullName) {
      await this.clerkClient.users.updateUser(clerkUid, {
        publicMetadata: { fullName: updates.fullName.trim() },
      });
    }

    if (updates.externalId) {
      await this.clerkClient.users.updateUser(clerkUid, {
        externalId: updates.externalId,
      });
    }
  }

  async deleteIdentity(clerkUid: string): Promise<void> {
    await this.clerkClient.users.deleteUser(clerkUid);
  }

  // ===== Private helpers =====

  private async replacePrimaryEmail(
    user: User,
    newEmail: string,
  ): Promise<void> {
    const list = await this.clerkClient.users.getUserList({
      emailAddress: [newEmail],
    });
    if (list.totalCount > 0 && list.data[0].id !== user.id) {
      throw new ConflictException("Email already exists");
    }

    const existing = (user.emailAddresses ?? []).find(
      (e) => e.emailAddress.toLowerCase() === newEmail.toLowerCase(),
    );

    let targetId = existing?.id;
    if (!targetId) {
      const created = await this.clerkClient.emailAddresses.createEmailAddress({
        userId: user.id,
        emailAddress: newEmail,
      });
      await this.clerkClient.emailAddresses.updateEmailAddress(created.id, {
        verified: true,
      });
      targetId = created.id;
    }

    if (user.primaryEmailAddressId !== targetId) {
      await this.clerkClient.users.updateUser(user.id, {
        primaryEmailAddressID: targetId,
      });
    }

    for (const email of user.emailAddresses ?? []) {
      if (email.id !== targetId) {
        await this.clerkClient.emailAddresses.deleteEmailAddress(email.id);
      }
    }
  }

  private async replacePrimaryPhone(
    user: User,
    newPhone: string,
  ): Promise<void> {
    const list = await this.clerkClient.users.getUserList({
      phoneNumber: [newPhone],
    });
    if (list.totalCount > 0 && list.data[0].id !== user.id) {
      throw new ConflictException("Phone number already exists");
    }

    const existing = (user.phoneNumbers ?? []).find(
      (p) => p.phoneNumber === newPhone,
    );

    let targetId = existing?.id;
    if (!targetId) {
      const created = await this.clerkClient.phoneNumbers.createPhoneNumber({
        userId: user.id,
        phoneNumber: newPhone,
      });
      await this.clerkClient.phoneNumbers.updatePhoneNumber(created.id, {
        verified: true,
      });
      targetId = created.id;
    }

    if (user.primaryPhoneNumberId !== targetId) {
      await this.clerkClient.users.updateUser(user.id, {
        primaryPhoneNumberID: targetId,
      });
    }

    for (const phone of user.phoneNumbers ?? []) {
      if (phone.id !== targetId) {
        await this.clerkClient.phoneNumbers.deletePhoneNumber(phone.id);
      }
    }
  }
}
