import { Module } from "@nestjs/common";
import { StorageService } from "../../application/file-management/ports/storage.service";
import { LocalStorageService } from "./local-storage.service";
import { R2StorageService } from "./r2-storage.service";

/**
 * Storage Module
 *
 * Provides storage abstraction for file uploads.
 * Uses Cloudflare R2 in production/when configured, falls back to local storage.
 */
@Module({
  providers: [
    {
      provide: StorageService,
      useFactory: () => {
        const useR2 =
          process.env.CLOUDFLARE_ACCOUNT_ID &&
          process.env.CLOUDFLARE_R2_ACCESS_KEY &&
          process.env.CLOUDFLARE_R2_SECRET_KEY &&
          process.env.CLOUDFLARE_R2_BUCKET;

        if (useR2) {
          console.log("📦 Using Cloudflare R2 storage");
          return new R2StorageService();
        }

        console.log("📁 Using local file storage");
        return new LocalStorageService();
      },
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
