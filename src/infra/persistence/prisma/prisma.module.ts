import { Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { PrismaUnitOfWork } from "./unit-of-work/prisma-unit-of-work";

@Module({
  providers: [
    PrismaService,
    {
      provide: UnitOfWorkPort,
      useClass: PrismaUnitOfWork,
    },
  ],
  exports: [PrismaService, UnitOfWorkPort],
})
export class PrismaModule {}
