import { Injectable, Logger } from "@nestjs/common";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { StorageService } from "../../application/file-management/ports/storage.service";

@Injectable()
export class R2StorageService implements StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicDomain: string;

  constructor() {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_KEY;
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET;
    const publicDomain = process.env.R2_PUBLIC_DOMAIN;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error(
        "Missing required R2 configuration. Please set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY, CLOUDFLARE_R2_SECRET_KEY, and CLOUDFLARE_R2_BUCKET environment variables.",
      );
    }

    this.bucketName = bucketName;
    this.publicDomain = publicDomain || "";

    // Cloudflare R2 endpoint format
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

    this.s3Client = new S3Client({
      region: "auto", // R2 uses 'auto' for region
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log(`R2 Storage initialized with bucket: ${bucketName}`);
  }

  /**
   * Generate a presigned URL for uploading a file to R2
   * @param key - The storage key (path) for the file
   * @param contentType - The MIME type of the file
   * @param expiresIn - URL expiration time in seconds (default: 1 hour)
   */
  async getUploadSignedUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn,
    });

    this.logger.debug(`Generated upload presigned URL for key: ${key}`);
    return signedUrl;
  }

  /**
   * Generate a presigned URL for downloading/viewing a file from R2
   * @param key - The storage key (path) for the file
   * @param expiresIn - URL expiration time in seconds (default: 1 hour)
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // If public domain is configured, return public URL
    if (this.publicDomain) {
      return `${this.publicDomain}/${key}`;
    }

    // Otherwise, generate a presigned URL
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn,
    });

    this.logger.debug(`Generated download presigned URL for key: ${key}`);
    return signedUrl;
  }

  /**
   * Delete a file from R2
   * @param key - The storage key (path) for the file to delete
   */
  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
    this.logger.debug(`Deleted file with key: ${key}`);
  }
}
