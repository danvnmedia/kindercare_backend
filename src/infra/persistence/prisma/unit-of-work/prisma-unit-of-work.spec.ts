import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";

import { PrismaService } from "../prisma.service";
import { PrismaUnitOfWork } from "./prisma-unit-of-work";

describe("PrismaUnitOfWork content-management wiring", () => {
  it("exposes workflow locks and CAS operations on the transaction context", async () => {
    const prismaTransaction = {};
    const prisma = {
      $transaction: jest.fn(async (task) => task(prismaTransaction)),
    } as unknown as PrismaService;
    const auditRecorder = {
      record: jest.fn(),
    } as unknown as AuditEventRecorderPort;
    const unitOfWork = new PrismaUnitOfWork(prisma, auditRecorder);

    await unitOfWork.run(async (tx) => {
      expect(tx.findPostByIdForUpdate).toEqual(expect.any(Function));
      expect(tx.findLatestPostApprovalRequestForUpdate).toEqual(
        expect.any(Function),
      );
      expect(tx.findPendingPostApprovalRequestForUpdate).toEqual(
        expect.any(Function),
      );
      expect(tx.updatePostApprovalRequestIfPending).toEqual(
        expect.any(Function),
      );
      expect(tx.findCampusSettingByCampusIdForUpdate).toEqual(
        expect.any(Function),
      );
      expect(tx.findPostByClientMutationId).toEqual(expect.any(Function));
      expect(tx.createPostIdempotently).toEqual(expect.any(Function));
    });
  });
});
