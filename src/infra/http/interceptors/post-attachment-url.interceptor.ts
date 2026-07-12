import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Observable, from, mergeMap } from "rxjs";

import { Entity } from "@/core/entities/entity";
import { Attachment, Post } from "@/domain/content-management";
import { File } from "@/domain/file-management/entities/file.entity";
import { StorageService } from "@/application/file-management/ports/storage.service";

export const MAX_ATTACHMENT_URL_SIGNING_CONCURRENCY = 8;

class AsyncLimiter {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await work();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.waiting.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    this.waiting.shift()?.();
  }
}

@Injectable()
export class PostAttachmentUrlInterceptor implements NestInterceptor {
  constructor(private readonly storageService: StorageService) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next
      .handle()
      .pipe(
        mergeMap((data: unknown) =>
          from(
            this.hydrate(
              data,
              new Map<string, Promise<string>>(),
              new AsyncLimiter(MAX_ATTACHMENT_URL_SIGNING_CONCURRENCY),
            ),
          ),
        ),
      );
  }

  private async hydrate(
    value: unknown,
    urls: Map<string, Promise<string>>,
    limiter: AsyncLimiter,
  ): Promise<unknown> {
    if (value === null || value === undefined || value instanceof Date) {
      return value;
    }
    if (value instanceof File) {
      let url = urls.get(value.key);
      if (!url) {
        url = limiter.run(() => this.storageService.getSignedUrl(value.key));
        urls.set(value.key, url);
      }
      let signedUrl: string;
      try {
        signedUrl = await url;
      } catch {
        throw new ServiceUnavailableException(
          "Attachment URLs are temporarily unavailable.",
        );
      }
      return { ...value.toPlain(), url: signedUrl };
    }
    if (value instanceof Post) {
      return this.hydrate(
        { ...value.toPlain(), attachments: value.attachments },
        urls,
        limiter,
      );
    }
    if (value instanceof Attachment) {
      return this.hydrate(
        { ...value.toPlain(), file: value.file },
        urls,
        limiter,
      );
    }
    if (value instanceof Entity) {
      return value;
    }
    if (Array.isArray(value)) {
      return Promise.all(
        value.map((item) => this.hydrate(item, urls, limiter)),
      );
    }
    if (typeof value === "object") {
      const entries = await Promise.all(
        Object.entries(value).map(async ([key, item]) => [
          key,
          await this.hydrate(item, urls, limiter),
        ]),
      );
      return Object.fromEntries(entries);
    }
    return value;
  }
}
