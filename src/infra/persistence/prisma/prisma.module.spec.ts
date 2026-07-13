import "reflect-metadata";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { AuditEventRepository } from "@/application/audit/ports/audit-event.repository";
import { HistoricalRecordRepository } from "@/application/class-management/ports/historical-record.repository";
import { StudentHardDeleteGuardPort } from "@/application/user-management/ports/student-hard-delete-guard.port";
import { PrismaModule } from "./prisma.module";

describe("PrismaModule provider wiring", () => {
  const providers =
    Reflect.getMetadata(MODULE_METADATA.PROVIDERS, PrismaModule) ?? [];
  const exports =
    Reflect.getMetadata(MODULE_METADATA.EXPORTS, PrismaModule) ?? [];

  it("exports cross-cutting historical and audit ports", () => {
    expect(exports).toEqual(
      expect.arrayContaining([
        AuditEventRepository,
        HistoricalRecordRepository,
        StudentHardDeleteGuardPort,
      ]),
    );
  });

  it("aliases student hard-delete retention checks to the historical persistence adapter", () => {
    expect(providers).toContainEqual({
      provide: StudentHardDeleteGuardPort,
      useExisting: HistoricalRecordRepository,
    });
  });
});
