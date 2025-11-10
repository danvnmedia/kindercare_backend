export type ProvisionInput = {
  email?: string;
  password?: string;
  phoneNumber?: string;
  // fullName go to publicMetadata
  fullName?: string;
  publicMetadata?: Record<string, unknown>;
};
