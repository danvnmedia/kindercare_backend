import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { EmailProcessor } from './processors/email.processor';
import { QueueService } from './queue.service';

@Module({
    imports: [
        BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                redis: {
                    host: configService.get('REDIS_HOST', 'localhost'),
                    port: configService.get('REDIS_PORT', 6379),
                    password: configService.get('REDIS_PASSWORD'),
                },
            }),
        }),
        BullModule.registerQueue({
            name: 'email',
        }),
    ],
    providers: [EmailProcessor, QueueService],
    exports: [QueueService, BullModule],
})
export class QueueModule {}