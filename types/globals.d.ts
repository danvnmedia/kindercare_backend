import type { AuthObject } from '@clerk/backend';
import type { PendingSessionOptions } from '@clerk/types';

declare global {
  namespace Express {
    interface Request {
      /**
       * Optional Clerk auth helper attached at runtime.
       */
      auth?: AuthObject & {
        (options?: PendingSessionOptions): AuthObject;
      };
    }
  }
}

export {};
