import { PrismaTransactionClient } from "./base.transaction-ops";
import { StaffTransactionOps } from "./staff.transaction-ops";

type StaffStaffTypeDelegateMock = {
  deleteMany: jest.Mock;
  createMany: jest.Mock;
};

describe("StaffTransactionOps", () => {
  let tx: { staffStaffType: StaffStaffTypeDelegateMock };
  let ops: StaffTransactionOps;

  beforeEach(() => {
    tx = {
      staffStaffType: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    ops = new StaffTransactionOps(tx as unknown as PrismaTransactionClient);
  });

  describe("replaceStaffTypes", () => {
    // Full-set replacement semantics per AC-10 of
    // @doc/specs/staff-multi-type-refactor: deleteMany clears the slate
    // inside the tx, then createMany inserts the new set. The sequencing
    // matters — flipping the order would risk a transient PK collision on
    // the composite (staffId, staffTypeId) when the new set overlaps the
    // old one. These tests lock that contract.

    it("issues deleteMany BEFORE createMany (sequencing invariant)", async () => {
      // Tag each mock call with a monotonically-incrementing index so we can
      // assert deleteMany fires strictly before createMany regardless of how
      // jest internally orders the resolved promises.
      let callIndex = 0;
      const order: Array<"delete" | "create"> = [];
      tx.staffStaffType.deleteMany.mockImplementation(async () => {
        order[callIndex++] = "delete";
        return { count: 1 };
      });
      tx.staffStaffType.createMany.mockImplementation(async () => {
        order[callIndex++] = "create";
        return { count: 2 };
      });

      await ops.replaceStaffTypes("staff-1", ["stype-1", "stype-2"]);

      expect(order).toEqual(["delete", "create"]);
    });

    it("clears existing rows for the supplied staffId only (deleteMany filter is scoped)", async () => {
      await ops.replaceStaffTypes("staff-1", ["stype-1"]);

      expect(tx.staffStaffType.deleteMany).toHaveBeenCalledTimes(1);
      // Filter MUST be scoped by staffId — a missing or widened where would
      // wipe out other staff's join rows inside the active tx.
      expect(tx.staffStaffType.deleteMany).toHaveBeenCalledWith({
        where: { staffId: "staff-1" },
      });
    });

    it("inserts one row per supplied staffTypeId with the parent staffId attached", async () => {
      await ops.replaceStaffTypes("staff-1", ["stype-1", "stype-2", "stype-3"]);

      expect(tx.staffStaffType.createMany).toHaveBeenCalledTimes(1);
      const arg = tx.staffStaffType.createMany.mock.calls[0][0];
      expect(arg.data).toEqual([
        { staffId: "staff-1", staffTypeId: "stype-1" },
        { staffId: "staff-1", staffTypeId: "stype-2" },
        { staffId: "staff-1", staffTypeId: "stype-3" },
      ]);
    });

    it("does NOT pass skipDuplicates — duplicates in input must surface as P2002 (caller bug)", async () => {
      // The DTO's `@IsUUID('4', { each: true })` does not enforce array
      // uniqueness; setting skipDuplicates here would silently swallow a
      // caller bug. Lock the structural absence of the flag.
      await ops.replaceStaffTypes("staff-1", ["stype-1"]);

      const arg = tx.staffStaffType.createMany.mock.calls[0][0];
      expect(arg).not.toHaveProperty("skipDuplicates");
    });

    it("short-circuits createMany when the new set is empty (defensive — Prisma rejects { data: [] })", async () => {
      // The deleteMany still fires (the legitimate "clear all join rows"
      // path), but the createMany is skipped because some Prisma client
      // versions error on empty `data` arrays and a no-op insert would be
      // wasted IO regardless.
      await ops.replaceStaffTypes("staff-1", []);

      expect(tx.staffStaffType.deleteMany).toHaveBeenCalledTimes(1);
      expect(tx.staffStaffType.deleteMany).toHaveBeenCalledWith({
        where: { staffId: "staff-1" },
      });
      expect(tx.staffStaffType.createMany).not.toHaveBeenCalled();
    });

    it("does not swallow deleteMany failure — createMany is NEVER reached if delete throws", async () => {
      // The UoW relies on this throw bubbling so the surrounding
      // `prisma.$transaction` rolls back. A try/catch around deleteMany
      // would silently leave the new set un-inserted with no signal.
      const dbError = new Error("simulated deleteMany failure");
      tx.staffStaffType.deleteMany.mockRejectedValueOnce(dbError);

      await expect(
        ops.replaceStaffTypes("staff-1", ["stype-1"]),
      ).rejects.toThrow("simulated deleteMany failure");

      expect(tx.staffStaffType.createMany).not.toHaveBeenCalled();
    });

    it("resolves to undefined (Promise<void> contract — no return value leaks)", async () => {
      tx.staffStaffType.deleteMany.mockResolvedValueOnce({ count: 3 });
      tx.staffStaffType.createMany.mockResolvedValueOnce({ count: 2 });

      const result = await ops.replaceStaffTypes("staff-1", [
        "stype-1",
        "stype-2",
      ]);

      // Port returns Promise<void>; assert nothing leaks (e.g. neither
      // delete count nor create count). Future refactors that decide to
      // return one of those values would change the port contract and
      // need an explicit decision, not a quiet drift.
      expect(result).toBeUndefined();
    });
  });
});
