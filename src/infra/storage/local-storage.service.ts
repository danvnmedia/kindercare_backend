import { Injectable } from "@nestjs/common";
import { StorageService } from "../../application/file-management/ports/storage.service";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);

@Injectable()
export class LocalStorageService implements StorageService {
  constructor() {
    mkdir(UPLOAD_DIR, { recursive: true }).catch((err) => {
      console.error("Failed to create upload directory", err);
    });
  }

  async getUploadSignedUrl(
    key: string,
    contentType: string,
    expiresIn?: number,
  ): Promise<string> {
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
    const filePath = path.join(UPLOAD_DIR, key);
    await unlink(filePath);
  }

  async getSignedUrl(key: string, expiresIn?: number): Promise<string> {
    return `${BASE_URL}/${key}`;
  }
}
