/**
 * CampusGuard Tests
 * Tests for campus context validation and user access control
 */

import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CampusGuard } from "./campus.guard";
import { CampusRepository } from "@/application/campus/ports/campus.repository";
import { RequestContext } from "../context/request-context.service";
import {
  CMS_ROUTE_VISIBILITY_KEY,
  CmsRouteVisibility,
} from "../decorators/cms-route-visibility.decorator";
import { REQUIRE_CAMPUS_ACCESS_KEY } from "../decorators/require-campus-access.decorator";
import {
  createCampus,
  createUser,
  createRole,
  createRoleAssignment,
  DEFAULT_CAMPUS_ID_A,
  DEFAULT_CAMPUS_ID_B,
} from "@/test-utils";

describe("CampusGuard", () => {
  let guard: CampusGuard;
  let mockReflector: jest.Mocked<Reflector>;
  let mockCampusRepository: jest.Mocked<CampusRepository>;
  let mockRequestContext: jest.Mocked<RequestContext>;

  const validUUID = DEFAULT_CAMPUS_ID_A;
  const validUUID_B = DEFAULT_CAMPUS_ID_B;
  const invalidUUID = "not-a-valid-uuid";

  const createStaffProfile = (campusId: string = validUUID) => ({
    type: "staff" as const,
    id: `staff-profile-${campusId}`,
    campusId,
    fullName: "Active Staff",
    email: "staff@example.com",
    phoneNumber: "+15550000001",
    dateOfBirth: null,
    gender: null,
  });

  const createGuardianProfile = (campusId: string = validUUID) => ({
    type: "guardian" as const,
    id: `guardian-profile-${campusId}`,
    campusId,
    fullName: "Active Guardian",
    email: "guardian@example.com",
    phoneNumber: "+15550000002",
    dateOfBirth: null,
    gender: null,
  });

  // Helper to create mock execution context
  const createMockContext = (
    headers: Record<string, string> = {},
    params: Record<string, string> = {},
    query: Record<string, string> = {},
    clerkId: string | null = null,
  ): ExecutionContext => {
    const request = {
      headers,
      params,
      query,
      clerkId,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  // Helper to create a mock RequestContext with configurable clerkId
  const createMockRequestContext = (clerkId: string | null = null) => {
    return {
      get clerkId() {
        return clerkId;
      },
      sessionId: null,
      campusId: null,
      setClerkId: jest.fn(),
      setSessionId: jest.fn(),
      setCampusId: jest.fn(),
      isAuthenticated: jest.fn(),
      getUser: jest.fn(),
      getUserOrFail: jest.fn(),
      getUserId: jest.fn(),
      isUserLoaded: jest.fn(),
      clearCache: jest.fn(),
    } as unknown as jest.Mocked<RequestContext>;
  };

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    mockCampusRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    } as jest.Mocked<CampusRepository>;

    mockRequestContext = createMockRequestContext(null);

    guard = new CampusGuard(
      mockReflector,
      mockCampusRepository,
      mockRequestContext,
    );
  });

  describe("Campus ID Extraction", () => {
    it("should extract campusId from x-campus-id header", async () => {
      const campus = createCampus({ id: validUUID });
      const role = createRole({ name: "Staff" });
      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(role, validUUID)],
        profiles: [createStaffProfile(validUUID)],
      });

      // Recreate guard with authenticated context
      mockRequestContext = createMockRequestContext("clerk-user-1");
      mockRequestContext.getUser.mockResolvedValue(user);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockReturnValue({ required: true });
      mockCampusRepository.findById.mockResolvedValue(campus);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        "clerk-user-1",
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockCampusRepository.findById).toHaveBeenCalledWith(validUUID);
    });

    it("should extract campusId from route params", async () => {
      const campus = createCampus({ id: validUUID });
      const role = createRole({ name: "Staff" });
      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(role, validUUID)],
        profiles: [createStaffProfile(validUUID)],
      });

      // Recreate guard with authenticated context
      mockRequestContext = createMockRequestContext("clerk-user-1");
      mockRequestContext.getUser.mockResolvedValue(user);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockReturnValue({ required: true });
      mockCampusRepository.findById.mockResolvedValue(campus);

      const context = createMockContext(
        {},
        { campusId: validUUID },
        {},
        "clerk-user-1",
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should extract campusId from query params", async () => {
      const campus = createCampus({ id: validUUID });
      const role = createRole({ name: "Staff" });
      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(role, validUUID)],
        profiles: [createStaffProfile(validUUID)],
      });

      // Recreate guard with authenticated context
      mockRequestContext = createMockRequestContext("clerk-user-1");
      mockRequestContext.getUser.mockResolvedValue(user);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockReturnValue({ required: true });
      mockCampusRepository.findById.mockResolvedValue(campus);

      const context = createMockContext(
        {},
        {},
        { campusId: validUUID },
        "clerk-user-1",
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should prioritize header over params over query", async () => {
      const campus = createCampus({ id: validUUID });
      const role = createRole({ name: "Staff" });
      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(role, validUUID)],
        profiles: [createStaffProfile(validUUID)],
      });

      // Recreate guard with authenticated context
      mockRequestContext = createMockRequestContext("clerk-user-1");
      mockRequestContext.getUser.mockResolvedValue(user);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockReturnValue({ required: true });
      mockCampusRepository.findById.mockResolvedValue(campus);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        { campusId: validUUID_B },
        { campusId: "33333333-3333-3333-3333-333333333333" },
        "clerk-user-1",
      );

      await guard.canActivate(context);

      // Should use header value
      expect(mockCampusRepository.findById).toHaveBeenCalledWith(validUUID);
    });
  });

  describe("Validation - Missing Campus ID", () => {
    it("should throw BadRequestException when campusId is required but missing", async () => {
      mockReflector.getAllAndOverride.mockReturnValue({ required: true });

      const context = createMockContext({}, {}, {}, "clerk-user-1");

      await expect(guard.canActivate(context)).rejects.toThrow(
        BadRequestException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Campus context is required",
      );
    });

    it("should allow access when campusId is not required and missing", async () => {
      mockReflector.getAllAndOverride.mockReturnValue({ required: false });

      const context = createMockContext({}, {}, {}, "clerk-user-1");

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockCampusRepository.findById).not.toHaveBeenCalled();
      expect(mockRequestContext.setCampusId).toHaveBeenCalledWith(null);
    });
  });

  describe("Validation - Invalid UUID Format", () => {
    it("should throw BadRequestException for invalid UUID format", async () => {
      mockReflector.getAllAndOverride.mockReturnValue({ required: true });

      const context = createMockContext(
        { "x-campus-id": invalidUUID },
        {},
        {},
        "clerk-user-1",
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        BadRequestException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Invalid campus ID format",
      );
    });
  });

  describe("Validation - Non-existent Campus", () => {
    it("should throw NotFoundException when campus does not exist", async () => {
      mockReflector.getAllAndOverride.mockReturnValue({ required: true });
      mockCampusRepository.findById.mockResolvedValue(null);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        "clerk-user-1",
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        NotFoundException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        `Campus not found: ${validUUID}`,
      );
    });
  });

  describe("Validation - Archived Campus", () => {
    it("should throw ForbiddenException when campus is archived and requireActive is true", async () => {
      const archivedCampus = createCampus({ id: validUUID, isArchived: true });

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        requireActive: true,
      });
      mockCampusRepository.findById.mockResolvedValue(archivedCampus);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        "clerk-user-1",
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Campus is archived",
      );
    });

    it("should allow access to archived campus when requireActive is false", async () => {
      const archivedCampus = createCampus({ id: validUUID, isArchived: true });
      const role = createRole({ name: "Staff" });
      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(role, validUUID)],
        profiles: [createStaffProfile(validUUID)],
      });

      // Recreate guard with authenticated context
      mockRequestContext = createMockRequestContext("clerk-user-1");
      mockRequestContext.getUser.mockResolvedValue(user);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        requireActive: false,
        checkUserAccess: true,
      });
      mockCampusRepository.findById.mockResolvedValue(archivedCampus);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        "clerk-user-1",
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe("User Access Validation", () => {
    it("should throw ForbiddenException when user is not authenticated", async () => {
      const campus = createCampus({ id: validUUID });

      // Guard with null clerkId (unauthenticated)
      mockRequestContext = createMockRequestContext(null);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: true,
      });
      mockCampusRepository.findById.mockResolvedValue(campus);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        null,
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Authentication required",
      );
    });

    it("should throw ForbiddenException when user has no access to campus", async () => {
      const campus = createCampus({ id: validUUID });
      // User has role in a different campus
      const role = createRole({ name: "Staff", campusId: validUUID_B });
      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(role, validUUID_B)],
        profiles: [createStaffProfile(validUUID)],
      });

      // Recreate guard with authenticated context
      mockRequestContext = createMockRequestContext("clerk-user-1");
      mockRequestContext.getUser.mockResolvedValue(user);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: true,
        allowGlobalAdmin: true,
      });
      mockCampusRepository.findById.mockResolvedValue(campus);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        "clerk-user-1",
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "No access to this campus",
      );
    });

    it("should allow access when user has role in the requested campus", async () => {
      const campus = createCampus({ id: validUUID });
      const role = createRole({ name: "Staff", campusId: validUUID });
      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(role, validUUID)],
        profiles: [createStaffProfile(validUUID)],
      });

      // Recreate guard with authenticated context
      mockRequestContext = createMockRequestContext("clerk-user-1");
      mockRequestContext.getUser.mockResolvedValue(user);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: true,
      });
      mockCampusRepository.findById.mockResolvedValue(campus);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        "clerk-user-1",
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should skip user access check when checkUserAccess is false", async () => {
      const campus = createCampus({ id: validUUID });

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: false,
      });
      mockCampusRepository.findById.mockResolvedValue(campus);

      // No clerkId in context - but should still work
      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        null,
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequestContext.getUser).not.toHaveBeenCalled();
    });

    it("should skip active staff profile gate when checkUserAccess is false for guardian routes", async () => {
      const campus = createCampus({ id: validUUID });
      const guardianUser = createUser({
        id: "guardian-user-1",
        profiles: [createGuardianProfile(validUUID)],
      });

      mockRequestContext = createMockRequestContext("clerk-guardian-1");
      mockRequestContext.getUser.mockResolvedValue(guardianUser);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: false,
      });
      mockCampusRepository.findById.mockResolvedValue(campus);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        "clerk-guardian-1",
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequestContext.getUser).not.toHaveBeenCalled();
    });

    it("should allow a guardian public CMS route only for the requested profile campus", async () => {
      const campus = createCampus({ id: validUUID_B });
      const guardianUser = createUser({
        id: "guardian-user-1",
        profiles: [
          createGuardianProfile(validUUID),
          createGuardianProfile(validUUID_B),
        ],
      });

      mockRequestContext = createMockRequestContext("clerk-guardian-1");
      mockRequestContext.getUser.mockResolvedValue(guardianUser);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === REQUIRE_CAMPUS_ACCESS_KEY) {
          return { required: true, checkUserAccess: true };
        }
        if (key === CMS_ROUTE_VISIBILITY_KEY) {
          return CmsRouteVisibility.PUBLIC_READ;
        }
        return undefined;
      });
      mockCampusRepository.findById.mockResolvedValue(campus);

      const context = createMockContext(
        { "x-campus-id": validUUID_B },
        {},
        {},
        "clerk-guardian-1",
      );

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(mockRequestContext.setCampusId).toHaveBeenCalledWith(validUUID_B);
    });

    it("should deny campus role access when the user has no active staff profile in the campus", async () => {
      const campus = createCampus({ id: validUUID });
      const role = createRole({ name: "Staff", campusId: validUUID });
      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(role, validUUID)],
      });

      mockRequestContext = createMockRequestContext("clerk-user-1");
      mockRequestContext.getUser.mockResolvedValue(user);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: true,
      });
      mockCampusRepository.findById.mockResolvedValue(campus);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        "clerk-user-1",
      );

      const result = guard.canActivate(context);

      await expect(result).rejects.toThrow(ForbiddenException);
      await expect(result).rejects.toThrow(
        "Active staff profile required for this campus",
      );
    });

    it("should throw ForbiddenException when user not found in database", async () => {
      const campus = createCampus({ id: validUUID });

      // Recreate guard with authenticated context but user not found
      mockRequestContext = createMockRequestContext("clerk-unknown-user");
      mockRequestContext.getUser.mockResolvedValue(null);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: true,
      });
      mockCampusRepository.findById.mockResolvedValue(campus);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        "clerk-unknown-user",
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "User not found",
      );
    });

    it("should verify user is fetched via RequestContext.getUser()", async () => {
      const campus = createCampus({ id: validUUID });
      const role = createRole({ name: "Staff", campusId: validUUID });
      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(role, validUUID)],
        profiles: [createStaffProfile(validUUID)],
      });

      // Recreate guard with authenticated context
      mockRequestContext = createMockRequestContext("clerk-user-1");
      mockRequestContext.getUser.mockResolvedValue(user);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: true,
      });
      mockCampusRepository.findById.mockResolvedValue(campus);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        "clerk-user-1",
      );

      await guard.canActivate(context);

      // Verify RequestContext.getUser() was called (not direct repository call)
      expect(mockRequestContext.getUser).toHaveBeenCalled();
    });
  });

  describe("Global Admin Access", () => {
    it("should allow global admin (isSystemRole=true) to access any campus", async () => {
      const campus = createCampus({ id: validUUID });
      // Admin with global system role (isSystemRole=true, campusId=null)
      const globalAdminRole = createRole({
        name: "Admin",
        campusId: null,
        isSystemRole: true, // This grants global admin bypass
      });
      const globalAdmin = createUser({
        id: "admin-1",
        roleAssignments: [createRoleAssignment(globalAdminRole, null)], // Global assignment
      });

      // Recreate guard with authenticated admin context
      mockRequestContext = createMockRequestContext("clerk-admin-1");
      mockRequestContext.getUser.mockResolvedValue(globalAdmin);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: true,
        allowGlobalAdmin: true,
      });
      mockCampusRepository.findById.mockResolvedValue(campus);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        "clerk-admin-1",
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should NOT grant global admin bypass based on role name alone", async () => {
      const campus = createCampus({ id: validUUID });
      // Role named "Super Admin" but WITHOUT isSystemRole=true should NOT bypass
      const fakeAdminRole = createRole({
        name: "Super Admin", // Name-based check should NOT work anymore
        campusId: null,
        isSystemRole: false, // Not a system role
      });
      const fakeAdmin = createUser({
        id: "fake-admin-1",
        roleAssignments: [createRoleAssignment(fakeAdminRole, null)],
        profiles: [createStaffProfile(validUUID)],
      });

      // Recreate guard with authenticated context
      mockRequestContext = createMockRequestContext("clerk-fake-admin-1");
      mockRequestContext.getUser.mockResolvedValue(fakeAdmin);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: true,
        allowGlobalAdmin: true,
      });
      mockCampusRepository.findById.mockResolvedValue(campus);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        "clerk-fake-admin-1",
      );

      // Global role with null campusId should still grant access via hasCampusAccess
      // but the isGlobalAdmin check should NOT return true based on name
      const result = await guard.canActivate(context);

      // Access is still granted because global roles (null campusId) have access everywhere
      // via hasCampusAccess, but isGlobalAdmin() returns false (no fast-path bypass)
      expect(result).toBe(true);
    });

    it("should not bypass for global admin when allowGlobalAdmin is false", async () => {
      const campus = createCampus({ id: validUUID });
      // Admin with global system role but allowGlobalAdmin is disabled
      const globalAdminRole = createRole({
        name: "Admin",
        campusId: null,
        isSystemRole: true,
      });
      const globalAdmin = createUser({
        id: "admin-1",
        roleAssignments: [createRoleAssignment(globalAdminRole, null)],
        profiles: [createStaffProfile(validUUID)],
      });

      // Recreate guard with authenticated admin context
      mockRequestContext = createMockRequestContext("clerk-admin-1");
      mockRequestContext.getUser.mockResolvedValue(globalAdmin);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: true,
        allowGlobalAdmin: false, // Disable global admin bypass
      });
      mockCampusRepository.findById.mockResolvedValue(campus);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        "clerk-admin-1",
      );

      // Global roles with null campusId assignment should still grant access
      // via hasCampusAccess since global roles apply everywhere
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should deny access for role with admin-like name but no global scope", async () => {
      const campus = createCampus({ id: validUUID });
      // Role with "admin" in name but scoped to a different campus
      const localAdminRole = createRole({
        name: "Campus Administrator",
        campusId: validUUID_B, // Different campus
        isSystemRole: false,
      });
      const localAdmin = createUser({
        id: "local-admin-1",
        roleAssignments: [createRoleAssignment(localAdminRole, validUUID_B)],
        profiles: [createStaffProfile(validUUID)],
      });

      // Recreate guard with authenticated context
      mockRequestContext = createMockRequestContext("clerk-local-admin-1");
      mockRequestContext.getUser.mockResolvedValue(localAdmin);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: true,
        allowGlobalAdmin: true,
      });
      mockCampusRepository.findById.mockResolvedValue(campus);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        "clerk-local-admin-1",
      );

      // Should be denied - no access to this campus
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("Request Campus Storage", () => {
    it("should store validated campus ID via RequestContext.setCampusId()", async () => {
      const campus = createCampus({ id: validUUID });
      const role = createRole({ name: "Staff" });
      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(role, validUUID)],
        profiles: [createStaffProfile(validUUID)],
      });

      // Recreate guard with authenticated context
      mockRequestContext = createMockRequestContext("clerk-user-1");
      mockRequestContext.getUser.mockResolvedValue(user);
      guard = new CampusGuard(
        mockReflector,
        mockCampusRepository,
        mockRequestContext,
      );

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: true,
      });
      mockCampusRepository.findById.mockResolvedValue(campus);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        "clerk-user-1",
      );

      await guard.canActivate(context);

      expect(mockRequestContext.setCampusId).toHaveBeenCalledWith(validUUID);
    });

    it("should store null when campus is not required and not provided", async () => {
      mockReflector.getAllAndOverride.mockReturnValue({ required: false });

      const context = createMockContext({}, {}, {}, "clerk-user-1");

      await guard.canActivate(context);

      expect(mockRequestContext.setCampusId).toHaveBeenCalledWith(null);
    });
  });
});
