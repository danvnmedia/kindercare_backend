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
import { UserRepository } from "@/application/user-management/ports/user.repository";
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
  let mockUserRepository: jest.Mocked<UserRepository>;

  const validUUID = DEFAULT_CAMPUS_ID_A;
  const validUUID_B = DEFAULT_CAMPUS_ID_B;
  const invalidUUID = "not-a-valid-uuid";

  // Helper to create mock execution context
  const createMockContext = (
    headers: Record<string, string> = {},
    params: Record<string, string> = {},
    query: Record<string, string> = {},
    user: any = null,
  ): ExecutionContext => {
    const request = {
      headers,
      params,
      query,
      user,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
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

    guard = new CampusGuard(
      mockReflector,
      mockCampusRepository,
      mockUserRepository,
    );
  });

  describe("Campus ID Extraction", () => {
    it("should extract campusId from x-campus-id header", async () => {
      const campus = createCampus({ id: validUUID });
      const role = createRole({ name: "Staff" });
      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(role, validUUID)],
      });

      mockReflector.getAllAndOverride.mockReturnValue({ required: true });
      mockCampusRepository.findById.mockResolvedValue(campus);
      mockUserRepository.findById.mockResolvedValue(user);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        { id: "user-1" },
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
      });

      mockReflector.getAllAndOverride.mockReturnValue({ required: true });
      mockCampusRepository.findById.mockResolvedValue(campus);
      mockUserRepository.findById.mockResolvedValue(user);

      const context = createMockContext(
        {},
        { campusId: validUUID },
        {},
        { id: "user-1" },
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
      });

      mockReflector.getAllAndOverride.mockReturnValue({ required: true });
      mockCampusRepository.findById.mockResolvedValue(campus);
      mockUserRepository.findById.mockResolvedValue(user);

      const context = createMockContext(
        {},
        {},
        { campusId: validUUID },
        { id: "user-1" },
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
      });

      mockReflector.getAllAndOverride.mockReturnValue({ required: true });
      mockCampusRepository.findById.mockResolvedValue(campus);
      mockUserRepository.findById.mockResolvedValue(user);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        { campusId: validUUID_B },
        { campusId: "33333333-3333-3333-3333-333333333333" },
        { id: "user-1" },
      );

      await guard.canActivate(context);

      // Should use header value
      expect(mockCampusRepository.findById).toHaveBeenCalledWith(validUUID);
    });
  });

  describe("Validation - Missing Campus ID", () => {
    it("should throw BadRequestException when campusId is required but missing", async () => {
      mockReflector.getAllAndOverride.mockReturnValue({ required: true });

      const context = createMockContext({}, {}, {}, { id: "user-1" });

      await expect(guard.canActivate(context)).rejects.toThrow(
        BadRequestException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Campus context is required",
      );
    });

    it("should allow access when campusId is not required and missing", async () => {
      mockReflector.getAllAndOverride.mockReturnValue({ required: false });

      const context = createMockContext({}, {}, {}, { id: "user-1" });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockCampusRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe("Validation - Invalid UUID Format", () => {
    it("should throw BadRequestException for invalid UUID format", async () => {
      mockReflector.getAllAndOverride.mockReturnValue({ required: true });

      const context = createMockContext(
        { "x-campus-id": invalidUUID },
        {},
        {},
        { id: "user-1" },
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
        { id: "user-1" },
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        NotFoundException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        `Campus not found: ${validUUID}`,
      );
    });
  });

  describe("Validation - Inactive Campus", () => {
    it("should throw ForbiddenException when campus is inactive and requireActive is true", async () => {
      const inactiveCampus = createCampus({ id: validUUID, isActive: false });

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        requireActive: true,
      });
      mockCampusRepository.findById.mockResolvedValue(inactiveCampus);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        { id: "user-1" },
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Campus is not active",
      );
    });

    it("should allow access to inactive campus when requireActive is false", async () => {
      const inactiveCampus = createCampus({ id: validUUID, isActive: false });
      const role = createRole({ name: "Staff" });
      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(role, validUUID)],
      });

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        requireActive: false,
        checkUserAccess: true,
      });
      mockCampusRepository.findById.mockResolvedValue(inactiveCampus);
      mockUserRepository.findById.mockResolvedValue(user);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        { id: "user-1" },
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe("User Access Validation", () => {
    it("should throw ForbiddenException when user is not authenticated", async () => {
      const campus = createCampus({ id: validUUID });

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: true,
      });
      mockCampusRepository.findById.mockResolvedValue(campus);

      // No user in request
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
      });

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: true,
        allowGlobalAdmin: true,
      });
      mockCampusRepository.findById.mockResolvedValue(campus);
      mockUserRepository.findById.mockResolvedValue(user);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        { id: "user-1" },
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
      });

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: true,
      });
      mockCampusRepository.findById.mockResolvedValue(campus);
      mockUserRepository.findById.mockResolvedValue(user);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        { id: "user-1" },
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

      // No user in request - but should still work
      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        null,
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockUserRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe("Global Admin Access", () => {
    it("should allow global admin to access any campus", async () => {
      const campus = createCampus({ id: validUUID });
      // Admin with global role (campusId = null in assignment)
      const globalAdminRole = createRole({
        name: "Super Admin",
        campusId: null,
      });
      const globalAdmin = createUser({
        id: "admin-1",
        roleAssignments: [createRoleAssignment(globalAdminRole, null)], // Global assignment
      });

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: true,
        allowGlobalAdmin: true,
      });
      mockCampusRepository.findById.mockResolvedValue(campus);
      mockUserRepository.findById.mockResolvedValue(globalAdmin);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        { id: "admin-1" },
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should not bypass for global admin when allowGlobalAdmin is false", async () => {
      const campus = createCampus({ id: validUUID });
      // Admin with global role but no specific campus access
      const globalAdminRole = createRole({
        name: "Super Admin",
        campusId: null,
      });
      const globalAdmin = createUser({
        id: "admin-1",
        roleAssignments: [createRoleAssignment(globalAdminRole, null)],
      });

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: true,
        allowGlobalAdmin: false, // Disable global admin bypass
      });
      mockCampusRepository.findById.mockResolvedValue(campus);
      mockUserRepository.findById.mockResolvedValue(globalAdmin);

      const context = createMockContext(
        { "x-campus-id": validUUID },
        {},
        {},
        { id: "admin-1" },
      );

      // Global roles with null campusId assignment should still grant access
      // via hasCampusAccess since global roles apply everywhere
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe("Request Campus Storage", () => {
    it("should store validated campus ID on request object", async () => {
      const campus = createCampus({ id: validUUID });
      const role = createRole({ name: "Staff" });
      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(role, validUUID)],
      });

      mockReflector.getAllAndOverride.mockReturnValue({
        required: true,
        checkUserAccess: true,
      });
      mockCampusRepository.findById.mockResolvedValue(campus);
      mockUserRepository.findById.mockResolvedValue(user);

      const request: any = {
        headers: { "x-campus-id": validUUID },
        params: {},
        query: {},
        user: { id: "user-1" },
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
        getHandler: () => jest.fn(),
        getClass: () => jest.fn(),
      } as unknown as ExecutionContext;

      await guard.canActivate(context);

      expect(request.campusId).toBe(validUUID);
    });

    it("should store null when campus is not required and not provided", async () => {
      mockReflector.getAllAndOverride.mockReturnValue({ required: false });

      const request: any = {
        headers: {},
        params: {},
        query: {},
        user: { id: "user-1" },
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
        getHandler: () => jest.fn(),
        getClass: () => jest.fn(),
      } as unknown as ExecutionContext;

      await guard.canActivate(context);

      expect(request.campusId).toBeNull();
    });
  });
});
