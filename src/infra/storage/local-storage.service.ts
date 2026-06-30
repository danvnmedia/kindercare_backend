import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { StorageService } from "../../application/file-management/ports/storage.service";
import { sanitizeFilePath } from "@/core/utils/security.utils";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly logger = new Logger(LocalStorageService.name);

  constructor() {
    mkdir(UPLOAD_DIR, { recursive: true }).catch((err) => {
      this.logger.error("Failed to create upload directory", err);
    });
  }

  async getUploadSignedUrl(
    key: string,
    contentType: string,
    expiresIn?: number,
  ): Promise<string> {
    void contentType;
    void expiresIn;
    // For local storage, we just return the direct URL where the file will be
    // accessible after it's been moved there by the client.
    // The client would then PUT the file directly to this URL.
    // In a real application, this would involve a server-side endpoint that
    // receives the file and moves it to the correct location.
    // For this example, we assume the client *knows* where to put the file
    // after getting this "signed" URL.
    return `${BASE_URL}/${key}`;
  }

  async delete(key: string): Promise<void> {
    // Sanitize the key to prevent path traversal attacks
    const sanitizedKey = sanitizeFilePath(key);
    const filePath = path.join(UPLOAD_DIR, sanitizedKey);

    // Verify the resolved path is still within UPLOAD_DIR
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadDir = path.resolve(UPLOAD_DIR);
    if (!resolvedPath.startsWith(resolvedUploadDir)) {
      this.logger.warn(`Path traversal attempt detected: ${key}`);
      throw new BadRequestException("Invalid file path");
    }

    await unlink(filePath);
  }

  async getSignedUrl(key: string, expiresIn?: number): Promise<string> {
    void expiresIn;
    return `${BASE_URL}/${key}`;
  }

  async getObjectMetadata(key: string) {
    const sanitizedKey = sanitizeFilePath(key);
    const filePath = path.join(UPLOAD_DIR, sanitizedKey);

    try {
      const stats = await fs.promises.stat(filePath);
      return {
        exists: stats.isFile(),
        contentLength: stats.size,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { exists: false };
      }

      throw error;
    }
  }
}
