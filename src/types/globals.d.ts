declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

export interface UserPayload {
  sub: string; // User ID from Clerk
  // Add other properties as needed from Clerk's session/user object
}