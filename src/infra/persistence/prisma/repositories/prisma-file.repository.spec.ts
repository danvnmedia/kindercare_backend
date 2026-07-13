import { FileStatus } from "@/domain/file-management/enums/file-status.enum";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { PrismaService } from "../prisma.service";
import { PrismaFileRepository } from "./prisma-file.repository";

const FILE_ID = "55555555-5555-4555-a555-555555555555";
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";

describe("PrismaFileRepository lifecycle claims", () => {
  let tx: {
    $queryRaw: jest.Mock;
    file: { findFirst: jest.Mock; updateMany: jest.Mock };
    attachment: { findFirst: jest.Mock };
  };
  let prisma: {
    file: { findMany: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let repository: PrismaFileRepository;

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: FILE_ID }]),
      file: {
        findFirst: jest.fn().mockResolvedValue({ id: FILE_ID }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      attachment: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    prisma = {
      file: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn((work) => work(tx)),
    };
    repository = new PrismaFileRepository(
      prisma as unknown as PrismaService,
      {} as PrismaQueryService,
    );
  });

  it("claims upload completion only from PENDING", async () => {
    await expect(
      repository.transitionStatus(
        FILE_ID,
        FileStatus.PENDING,
        FileStatus.UPLOADED,
      ),
    ).resolves.toBe(true);

    expect(prisma.file.updateMany).toHaveBeenCalledWith({
      where: {
        id: FILE_ID,
        status: FileStatus.PENDING,
        isDeleted: false,
      },
      data: { status: FileStatus.UPLOADED },
    });
  });

  it("reports a lost status claim without overwriting the winner", async () => {
    prisma.file.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.transitionStatus(
        FILE_ID,
        FileStatus.PENDING,
        FileStatus.UPLOADED,
      ),
    ).resolves.toBe(false);
  });

  it("finds stale PENDING and ERROR cleanup candidates", async () => {
    const cutoff = new Date("2026-07-01T11:00:00.000Z");

    await repository.findCleanupCandidates(cutoff, 100);

    expect(prisma.file.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: [FileStatus.PENDING, FileStatus.ERROR] },
        isDeleted: false,
        updatedAt: { lt: cutoff },
      },
      orderBy: { updatedAt: "asc" },
      take: 100,
    });
  });

  it.each([FileStatus.PENDING, FileStatus.ERROR])(
    "claims stale %s cleanup with an updated retry lease",
    async (status) => {
      const cutoff = new Date("2026-07-01T11:00:00.000Z");

      const leaseToken = await repository.claimStaleForCleanup(
        FILE_ID,
        status,
        cutoff,
      );

      expect(leaseToken).toBeInstanceOf(Date);
      expect(prisma.file.updateMany).toHaveBeenCalledWith({
        where: {
          id: FILE_ID,
          status,
          isDeleted: false,
          updatedAt: { lt: cutoff },
        },
        data: { status: FileStatus.ERROR, updatedAt: leaseToken },
      });
    },
  );

  it("reports a cleanup claim lost to another worker", async () => {
    prisma.file.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.claimStaleForCleanup(
        FILE_ID,
        FileStatus.ERROR,
        new Date("2026-07-01T11:00:00.000Z"),
      ),
    ).resolves.toBeNull();
  });

  it("soft-deletes an ERROR row only for the current lease token", async () => {
    const leaseToken = new Date("2026-07-01T12:00:00.000Z");

    await expect(repository.completeCleanup(FILE_ID, leaseToken)).resolves.toBe(
      true,
    );

    expect(prisma.file.updateMany).toHaveBeenCalledWith({
      where: {
        id: FILE_ID,
        status: FileStatus.ERROR,
        isDeleted: false,
        updatedAt: leaseToken,
      },
      data: { isDeleted: true },
    });
  });

  it("rejects finalization from an expired lease after reclaim", async () => {
    const expiredLease = new Date("2026-07-01T11:00:00.000Z");
    const reclaimedLease = await repository.claimStaleForCleanup(
      FILE_ID,
      FileStatus.ERROR,
      new Date("2026-07-01T11:30:00.000Z"),
    );
    expect(reclaimedLease).toBeInstanceOf(Date);
    expect(reclaimedLease).not.toEqual(expiredLease);
    prisma.file.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      repository.completeCleanup(FILE_ID, expiredLease),
    ).resolves.toBe(false);

    expect(prisma.file.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ updatedAt: expiredLease }),
      }),
    );
  });

  it("checks attachment references under the file row lock", async () => {
    tx.attachment.findFirst.mockResolvedValue({ id: "attachment-1" });

    await expect(
      repository.softDeleteIfUnattached(FILE_ID, CAMPUS_ID),
    ).resolves.toBe("ATTACHED");

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.attachment.findFirst).toHaveBeenCalledWith({
      where: { fileId: FILE_ID },
      select: { id: true },
    });
    expect(tx.file.updateMany).not.toHaveBeenCalled();
  });

  it("soft-deletes an unattached file inside the lock transaction", async () => {
    await expect(
      repository.softDeleteIfUnattached(FILE_ID, CAMPUS_ID),
    ).resolves.toBe("DELETED");

    expect(tx.file.updateMany).toHaveBeenCalledWith({
      where: { id: FILE_ID, campusId: CAMPUS_ID, isDeleted: false },
      data: { isDeleted: true },
    });
  });
});
