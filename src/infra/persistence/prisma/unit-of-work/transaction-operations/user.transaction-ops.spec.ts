import { PrismaTransactionClient } from "./base.transaction-ops";
import { UserTransactionOps } from "./user.transaction-ops";

type UserRoleDelegateMock = {
  createMany: jest.Mock;
  deleteMany: jest.Mock;
};

describe("UserTransactionOps", () => {
  let tx: { userRole: UserRoleDelegateMock };
  let ops: UserTransactionOps;

  beforeEach(() => {
    tx = {
      userRole: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    ops = new UserTransactionOps(tx as unknown as PrismaTransactionClient);
  });

  describe("assignRoles", () => {
    it("writes grantedViaStaffTypeId through to the data payload when supplied", async () => {
      tx.userRole.createMany.mockResolvedValue({ count: 1 });

      await ops.assignRoles("user-1", [
        {
          roleId: "role-1",
          campusId: "campus-1",
          grantedViaStaffTypeId: "stype-1",
        },
      ]);

      expect(tx.userRole.createMany).toHaveBeenCalledTimes(1);
      const arg = tx.userRole.createMany.mock.calls[0][0];
      expect(arg.data).toEqual([
        {
          userId: "user-1",
          roleId: "role-1",
          campusId: "campus-1",
          grantedViaStaffTypeId: "stype-1",
        },
      ]);
      // SQL-level conflict policy = D5 manual-wins. Must stay on.
      expect(arg.skipDuplicates).toBe(true);
    });

    it("writes null grantedViaStaffTypeId when omitted (existing callers unchanged)", async () => {
      tx.userRole.createMany.mockResolvedValue({ count: 1 });

      // Shape matches how non-tracked use cases (CreateStaffUseCase,
      // UpdateStaffUseCase pre-refactor) currently call the op.
      await ops.assignRoles("user-1", [
        { roleId: "role-1", campusId: "campus-1" },
      ]);

      const arg = tx.userRole.createMany.mock.calls[0][0];
      expect(arg.data[0]).toMatchObject({
        userId: "user-1",
        roleId: "role-1",
        campusId: "campus-1",
        grantedViaStaffTypeId: null,
      });
    });

    it("maps undefined campusId to null (global assignment)", async () => {
      tx.userRole.createMany.mockResolvedValue({ count: 1 });

      await ops.assignRoles("user-1", [{ roleId: "role-1" }]);

      const arg = tx.userRole.createMany.mock.calls[0][0];
      expect(arg.data[0]).toMatchObject({
        userId: "user-1",
        roleId: "role-1",
        campusId: null,
        grantedViaStaffTypeId: null,
      });
    });

    it("returns the inserted count reported by createMany", async () => {
      tx.userRole.createMany.mockResolvedValue({ count: 2 });

      const inserted = await ops.assignRoles("user-1", [
        { roleId: "role-1", campusId: "campus-1" },
        { roleId: "role-2", campusId: "campus-1" },
      ]);

      expect(inserted).toBe(2);
    });

    it("returns 0 when every row collides with the unique constraint (D5 no-op)", async () => {
      // skipDuplicates: true → Prisma emits ON CONFLICT DO NOTHING; conflicted
      // rows are silently skipped and do NOT count toward `count`.
      tx.userRole.createMany.mockResolvedValue({ count: 0 });

      const inserted = await ops.assignRoles("user-1", [
        {
          roleId: "role-1",
          campusId: "campus-1",
          grantedViaStaffTypeId: "stype-1",
        },
      ]);

      expect(inserted).toBe(0);
    });
  });

  describe("revokeRolesByProvenance", () => {
    it("deletes only rows matching (userId, grantedViaStaffTypeId)", async () => {
      tx.userRole.deleteMany.mockResolvedValue({ count: 1 });

      await ops.revokeRolesByProvenance("user-1", "stype-1");

      expect(tx.userRole.deleteMany).toHaveBeenCalledTimes(1);
      // Exact-shape assertion: the filter MUST NOT include NULL coercion or
      // campusId — that would risk widening the delete to manual grants.
      expect(tx.userRole.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1", grantedViaStaffTypeId: "stype-1" },
      });
    });

    it("returns the deleted count from deleteMany", async () => {
      tx.userRole.deleteMany.mockResolvedValue({ count: 3 });

      const deleted = await ops.revokeRolesByProvenance("user-1", "stype-1");

      expect(deleted).toBe(3);
    });

    it("returns 0 when no tracked grant exists for this pair", async () => {
      tx.userRole.deleteMany.mockResolvedValue({ count: 0 });

      const deleted = await ops.revokeRolesByProvenance(
        "user-with-no-grant",
        "stype-1",
      );

      expect(deleted).toBe(0);
    });

    it("never widens to NULL-provenance rows (SQL semantics — string ≠ NULL)", async () => {
      // We can't actually exercise the DB here, but the structural guarantee
      // is the where shape — a non-nullable string param in `where` means
      // Prisma compiles to `WHERE granted_via_staff_type_id = $1`, which
      // never matches NULL rows. Lock that shape down.
      tx.userRole.deleteMany.mockResolvedValue({ count: 0 });

      await ops.revokeRolesByProvenance("user-1", "stype-1");

      const arg = tx.userRole.deleteMany.mock.calls[0][0];
      expect(arg.where).toEqual({
        userId: "user-1",
        grantedViaStaffTypeId: "stype-1",
      });
      // Negative assertion: no "OR" / nullable matcher leaked into the filter.
      expect(arg.where).not.toHaveProperty("OR");
      expect(arg.where.grantedViaStaffTypeId).not.toBeNull();
    });
  });

  describe("revokeRoles", () => {
    it("deletes by exact (userId, roleId, campusId) tuple — no provenance clause leaked into the filter", async () => {
      tx.userRole.deleteMany.mockResolvedValue({ count: 1 });

      await ops.revokeRoles("user-1", [
        { roleId: "role-1", campusId: "campus-1" },
      ]);

      expect(tx.userRole.deleteMany).toHaveBeenCalledTimes(1);
      // Exact-shape assertion: userId outside the OR, tuples inside.
      expect(tx.userRole.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          OR: [{ roleId: "role-1", campusId: "campus-1" }],
        },
      });
    });

    it("returns the deleted count from deleteMany", async () => {
      tx.userRole.deleteMany.mockResolvedValue({ count: 2 });

      const deleted = await ops.revokeRoles("user-1", [
        { roleId: "role-1", campusId: "campus-1" },
        { roleId: "role-2", campusId: "campus-1" },
      ]);

      expect(deleted).toBe(2);
    });

    it("returns 0 when no row matches the natural key (idempotent revoke)", async () => {
      tx.userRole.deleteMany.mockResolvedValue({ count: 0 });

      const deleted = await ops.revokeRoles("user-with-no-row", [
        { roleId: "role-1", campusId: "campus-1" },
      ]);

      expect(deleted).toBe(0);
    });

    it("scopes the delete to the supplied userId — different-user rows cannot match", async () => {
      tx.userRole.deleteMany.mockResolvedValue({ count: 0 });

      await ops.revokeRoles("user-1", [
        { roleId: "role-1", campusId: "campus-1" },
      ]);

      const arg = tx.userRole.deleteMany.mock.calls[0][0];
      // `userId` lives OUTSIDE the OR, so Prisma compiles to
      //   WHERE user_id = $1 AND ((role_id = $2 AND campus_id = $3) OR ...)
      // A row owned by a different user can never satisfy the outer userId
      // predicate, regardless of how the OR matches.
      expect(arg.where.userId).toBe("user-1");
      expect(arg.where).toHaveProperty("OR");
    });

    it("never narrows by provenance — deletes both NULL and non-NULL provenance rows when the natural key matches (Scenario 9 lockdown)", async () => {
      tx.userRole.deleteMany.mockResolvedValue({ count: 2 });

      await ops.revokeRoles("user-1", [
        { roleId: "role-1", campusId: "campus-1" },
      ]);

      const arg = tx.userRole.deleteMany.mock.calls[0][0];
      // Structural lock: the filter must never mention grantedViaStaffTypeId
      // anywhere. Without it, SQL evaluates the predicate against every row
      // matching (userId, roleId, campusId) — manual (NULL) AND tracked
      // (non-NULL) rows alike. That's the boundary contract with
      // tracked-grant-revocation: this op does NOT respect provenance.
      expect(arg.where).not.toHaveProperty("grantedViaStaffTypeId");
      expect(arg.where).not.toHaveProperty("AND");
      for (const clause of arg.where.OR) {
        expect(clause).not.toHaveProperty("grantedViaStaffTypeId");
      }
    });

    it("passes campusId=null through unchanged for global-role removal", async () => {
      // Same op also removes global role grants (campusId IS NULL). The
      // mapper must not coerce or drop the null — Prisma needs the explicit
      // null to compile `campus_id IS NULL` in the OR branch.
      tx.userRole.deleteMany.mockResolvedValue({ count: 1 });

      await ops.revokeRoles("user-1", [{ roleId: "role-1", campusId: null }]);

      const arg = tx.userRole.deleteMany.mock.calls[0][0];
      expect(arg.where.OR[0]).toEqual({ roleId: "role-1", campusId: null });
    });
  });
});
