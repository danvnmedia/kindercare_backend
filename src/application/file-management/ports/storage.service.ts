import { Express } from 'express';

export abstract class StorageService {
  abstract getUploadSignedUrl(
    key: string,
    contentType: string,
    expiresIn?: number,
  ): Promise<string>;
  abstract delete(key: string): Promise<void>;
  abstract getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}
