import { User } from "@/domain/user-management/user.entity";

declare global {
  namespace Express {
    interface Request {
      /**
       * Authenticated user entity (set by RequestContext/guards)
       */
      user?: User;

      /**
       * Clerk user ID from authentication (set by AuthMiddleware)
       */
      clerkId?: string;

      /**
       * Session ID from authentication (set by AuthMiddleware)
       */
      sessionId?: string;

      /**
       * Campus ID from validated campus context (set by CampusGuard/RequestContext)
       */
      campusId?: string | null;
    }
  }
}

/**
 * @deprecated Use User entity from @/domain/user-management/user.entity instead
 */
export interface UserPayload {
  sub: string; // User ID from Clerk
}
