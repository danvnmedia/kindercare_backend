import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { StandardResponseInterceptor } from './interceptors/standard-response.interceptor';
import { QueryValidatorService } from './services/query-validator.service';
import { QueryService } from './services/query.service';
import { PrismaQueryService } from './services/prisma-query.service';

@Module({
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useClass: StandardResponseInterceptor,
        },
        StandardResponseInterceptor,
        QueryValidatorService,
        QueryService,
        PrismaQueryService,
    ],
    exports: [
        StandardResponseInterceptor,
        QueryValidatorService,
        QueryService,
        PrismaQueryService,
    ],
})
export class StandardResponseModule { }
