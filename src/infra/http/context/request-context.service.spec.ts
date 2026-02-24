/**
 * RequestContext Service Tests
 *
 * Tests for the request-scoped authentication context service.
 * Verifies lazy loading, caching, and proper synchronization with request object.
 */

import { UnauthorizedException } from "@nestjs/common";
import {
  RequestContext,
  AuthenticatedRequest,
} from "./request-context.service";
import { UserRepository } from "@/application/user-management/ports/user.repository";
import { createUser } from "@/test-utils";

describe("RequestContext", () => {
  let requestContext: RequestContext;
  let mockRequest: AuthenticatedRequest;
  let mockUserRepository: jest.Mocked<UserRepository>;

  const createMockRequest = (
    clerkId?: string,
    sessionId?: string,
    campusId?: string | null,
  ): AuthenticatedRequest => {
    return {
      clerkId,
      sessionId,
      campusId,
    } as AuthenticatedRequest;
  };

  beforeEach(() => {
    mockUserRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByClerkUid: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      assignRoles: jest.fn(),
      removeRoles: jest.fn(),
      getUserRoles: jest.fn(),
      getUserRolesForCampus: jest.fn(),
    } as jest.Mocked<UserRepository>;

    mockRequest = createMockRequest();
  });

  describe("Initialization", () => {
    it("should initialize with null clerkId when request has no authentication", () => {
      requestContext = new RequestContext(mockRequest, mockUserRepository);

      expect(requestContext.clerkId).toBeNull();
      expect(requestContext.sessionId).toBeNull();
      expect(requestContext.campusId).toBeNull();
    });

    it("should initialize from request when clerkId is already set", () => {
      mockRequest = createMockRequest(
        "clerk-user-1",
        "session-123",
        "campus-1",
      );
      requestContext = new RequestContext(mockRequest, mockUserRepository);

      expect(requestContext.clerkId).toBe("clerk-user-1");
      expect(requestContext.sessionId).toBe("session-123");
      expect(requestContext.campusId).toBe("campus-1");
    });

    it("should use cached user from request if already set", async () => {
      const user = createUser({ id: "user-1" });
      mockRequest = createMockRequest("clerk-user-1");
      mockRequest.user = user;

      requestContext = new RequestContext(mockRequest, mockUserRepository);
      const result = await requestContext.getUser();

      expect(result).toBe(user);
      expect(mockUserRepository.findByClerkUid).not.toHaveBeenCalled();
    });
  });

  describe("isAuthenticated", () => {
    it("should return false when not authenticated", () => {
      requestContext = new RequestContext(mockRequest, mockUserRepository);

      expect(requestContext.isAuthenticated()).toBe(false);
    });

    it("should return true when clerkId is set", () => {
      mockRequest = createMockRequest("clerk-user-1");
      requestContext = new RequestContext(mockRequest, mockUserRepository);

      expect(requestContext.isAuthenticated()).toBe(true);
    });
  });

  describe("setClerkId", () => {
    it("should set clerkId and sync to request", () => {
      requestContext = new RequestContext(mockRequest, mockUserRepository);

      requestContext.setClerkId("clerk-user-1");

      expect(requestContext.clerkId).toBe("clerk-user-1");
      expect(mockRequest.clerkId).toBe("clerk-user-1");
    });
  });

  describe("setSessionId", () => {
    it("should set sessionId and sync to request", () => {
      requestContext = new RequestContext(mockRequest, mockUserRepository);

      requestContext.setSessionId("session-123");

      expect(requestContext.sessionId).toBe("session-123");
      expect(mockRequest.sessionId).toBe("session-123");
    });
  });

  describe("setCampusId", () => {
    it("should set campusId and sync to request", () => {
      requestContext = new RequestContext(mockRequest, mockUserRepository);

      requestContext.setCampusId("campus-1");

      expect(requestContext.campusId).toBe("campus-1");
      expect(mockRequest.campusId).toBe("campus-1");
    });

    it("should handle null campusId", () => {
      requestContext = new RequestContext(mockRequest, mockUserRepository);

      requestContext.setCampusId(null);

      expect(requestContext.campusId).toBeNull();
      expect(mockRequest.campusId).toBeNull();
    });
  });

  describe("getUser - Lazy Loading", () => {
    it("should return null when not authenticated", async () => {
      requestContext = new RequestContext(mockRequest, mockUserRepository);

      const user = await requestContext.getUser();

      expect(user).toBeNull();
      expect(mockUserRepository.findByClerkUid).not.toHaveBeenCalled();
    });

    it("should fetch user from repository on first call", async () => {
      const expectedUser = createUser({ id: "user-1" });
      mockRequest = createMockRequest("clerk-user-1");
      mockUserRepository.findByClerkUid.mockResolvedValue(expectedUser);

      requestContext = new RequestContext(mockRequest, mockUserRepository);
      const user = await requestContext.getUser();

      expect(user).toBe(expectedUser);
      expect(mockUserRepository.findByClerkUid).toHaveBeenCalledWith(
        "clerk-user-1",
      );
      expect(mockUserRepository.findByClerkUid).toHaveBeenCalledTimes(1);
    });

    it("should return null when user not found", async () => {
      mockRequest = createMockRequest("clerk-user-1");
      mockUserRepository.findByClerkUid.mockResolvedValue(null);

      requestContext = new RequestContext(mockRequest, mockUserRepository);
      const user = await requestContext.getUser();

      expect(user).toBeNull();
    });

    it("should sync user to request after fetching", async () => {
      const expectedUser = createUser({ id: "user-1" });
      mockRequest = createMockRequest("clerk-user-1");
      mockUserRepository.findByClerkUid.mockResolvedValue(expectedUser);

      requestContext = new RequestContext(mockRequest, mockUserRepository);
      await requestContext.getUser();

      expect(mockRequest.user).toBe(expectedUser);
    });
  });

  describe("getUser - Caching", () => {
    it("should cache user and not re-fetch on subsequent calls", async () => {
      const expectedUser = createUser({ id: "user-1" });
      mockRequest = createMockRequest("clerk-user-1");
      mockUserRepository.findByClerkUid.mockResolvedValue(expectedUser);

      requestContext = new RequestContext(mockRequest, mockUserRepository);

      // First call - should fetch
      const user1 = await requestContext.getUser();
      // Second call - should return cached
      const user2 = await requestContext.getUser();
      // Third call - should still return cached
      const user3 = await requestContext.getUser();

      expect(user1).toBe(expectedUser);
      expect(user2).toBe(expectedUser);
      expect(user3).toBe(expectedUser);
      expect(mockUserRepository.findByClerkUid).toHaveBeenCalledTimes(1);
    });

    it("should cache null result when user not found", async () => {
      mockRequest = createMockRequest("clerk-user-1");
      mockUserRepository.findByClerkUid.mockResolvedValue(null);

      requestContext = new RequestContext(mockRequest, mockUserRepository);

      await requestContext.getUser();
      await requestContext.getUser();

      expect(mockUserRepository.findByClerkUid).toHaveBeenCalledTimes(1);
    });
  });

  describe("getUserOrFail", () => {
    it("should return user when authenticated and found", async () => {
      const expectedUser = createUser({ id: "user-1" });
      mockRequest = createMockRequest("clerk-user-1");
      mockUserRepository.findByClerkUid.mockResolvedValue(expectedUser);

      requestContext = new RequestContext(mockRequest, mockUserRepository);
      const user = await requestContext.getUserOrFail();

      expect(user).toBe(expectedUser);
    });

    it("should throw UnauthorizedException when not authenticated", async () => {
      requestContext = new RequestContext(mockRequest, mockUserRepository);

      await expect(requestContext.getUserOrFail()).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(requestContext.getUserOrFail()).rejects.toThrow(
        "Authentication required",
      );
    });

    it("should throw UnauthorizedException when user not found", async () => {
      mockRequest = createMockRequest("clerk-user-1");
      mockUserRepository.findByClerkUid.mockResolvedValue(null);

      requestContext = new RequestContext(mockRequest, mockUserRepository);

      await expect(requestContext.getUserOrFail()).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(requestContext.getUserOrFail()).rejects.toThrow(
        "User not found",
      );
    });
  });

  describe("getUserId", () => {
    it("should return user ID when authenticated", async () => {
      const expectedUser = createUser({ id: "user-1" });
      mockRequest = createMockRequest("clerk-user-1");
      mockUserRepository.findByClerkUid.mockResolvedValue(expectedUser);

      requestContext = new RequestContext(mockRequest, mockUserRepository);
      const userId = await requestContext.getUserId();

      expect(userId).toBe("user-1");
    });

    it("should return null when not authenticated", async () => {
      requestContext = new RequestContext(mockRequest, mockUserRepository);
      const userId = await requestContext.getUserId();

      expect(userId).toBeNull();
    });
  });

  describe("isUserLoaded", () => {
    it("should return false before getUser is called", () => {
      mockRequest = createMockRequest("clerk-user-1");
      requestContext = new RequestContext(mockRequest, mockUserRepository);

      expect(requestContext.isUserLoaded()).toBe(false);
    });

    it("should return true after getUser is called", async () => {
      mockRequest = createMockRequest("clerk-user-1");
      mockUserRepository.findByClerkUid.mockResolvedValue(
        createUser({ id: "user-1" }),
      );

      requestContext = new RequestContext(mockRequest, mockUserRepository);
      await requestContext.getUser();

      expect(requestContext.isUserLoaded()).toBe(true);
    });

    it("should return true after getUser returns null", async () => {
      mockRequest = createMockRequest("clerk-user-1");
      mockUserRepository.findByClerkUid.mockResolvedValue(null);

      requestContext = new RequestContext(mockRequest, mockUserRepository);
      await requestContext.getUser();

      expect(requestContext.isUserLoaded()).toBe(true);
    });
  });

  describe("clearCache", () => {
    it("should clear cached user and allow re-fetch", async () => {
      const user1 = createUser({ id: "user-1" });
      const user2 = createUser({ id: "user-2" });
      mockRequest = createMockRequest("clerk-user-1");
      mockUserRepository.findByClerkUid
        .mockResolvedValueOnce(user1)
        .mockResolvedValueOnce(user2);

      requestContext = new RequestContext(mockRequest, mockUserRepository);

      // First fetch
      const result1 = await requestContext.getUser();
      expect(result1).toBe(user1);

      // Clear cache
      requestContext.clearCache();
      expect(requestContext.isUserLoaded()).toBe(false);

      // Second fetch should call repository again
      const result2 = await requestContext.getUser();
      expect(result2).toBe(user2);
      expect(mockUserRepository.findByClerkUid).toHaveBeenCalledTimes(2);
    });
  });

  describe("Error Handling", () => {
    it("should handle repository errors gracefully", async () => {
      mockRequest = createMockRequest("clerk-user-1");
      mockUserRepository.findByClerkUid.mockRejectedValue(
        new Error("Database error"),
      );

      requestContext = new RequestContext(mockRequest, mockUserRepository);
      const user = await requestContext.getUser();

      expect(user).toBeNull();
      expect(requestContext.isUserLoaded()).toBe(true);
    });
  });
});
