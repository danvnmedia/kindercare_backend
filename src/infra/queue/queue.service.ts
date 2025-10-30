import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EmailJobData } from './processors/email.processor';

@Injectable()
export class QueueService {
    constructor(
        @InjectQueue('email') private emailQueue: Queue,
    ) {}

    async addEmailJob(data: EmailJobData, delay?: number) {
        const job = await this.emailQueue.add('send-email', data, {
            delay,
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000,
            },
        });

        return job.id;
    }

    async getEmailQueueStatus() {
        const waiting = await this.emailQueue.getWaiting();
        const active = await this.emailQueue.getActive();
        const completed = await this.emailQueue.getCompleted();
        const failed = await this.emailQueue.getFailed();

        return {
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
        };
    }
}