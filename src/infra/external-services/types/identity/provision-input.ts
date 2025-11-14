export type ProvisionInput = {
  externalId?: string;
  email?: string;
  password?: string;
  phoneNumber?: string;
  // fullName go to publicMetadata
  fullName?: string;
  publicMetadata?: Record<string, unknown>;
};
