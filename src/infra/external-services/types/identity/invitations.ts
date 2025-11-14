export type InvitationInput = {
  email: string;
  metadata: {
    fullName: string;
    phoneNumber: string;
  };
}


export type InvitationResult = {
  id: string;
  email: string;
  metadata: {
    fullName: string;
    phoneNumber: string;
  };
};
