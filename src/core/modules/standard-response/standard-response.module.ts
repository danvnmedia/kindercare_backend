import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { StandardResponseInterceptor } from "./interceptors/standard-response.interceptor";
import { QueryValidatorService } from "./services/query-validator.service";
// import { QueryService } from './services/query.service'; // TypeORM-based, not used with Prisma
import { PrismaQueryService } from "./services/prisma-query.service";

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: StandardResponseInterceptor,
    },
    StandardResponseInterceptor,
    QueryValidatorService,
    // QueryService, // TypeORM-based, not used with Prisma
    PrismaQueryService,
  ],
  exports: [
    StandardResponseInterceptor,
    QueryValidatorService,
    // QueryService, // TypeORM-based, not used with Prisma
    PrismaQueryService,
  ],
})
export class StandardResponseModule {}
