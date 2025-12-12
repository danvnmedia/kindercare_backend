import { Module } from "@nestjs/common";
import { StorageService } from "../../application/file-management/ports/storage.service";
import { LocalStorageService } from "./local-storage.service";

@Module({
  providers: [
    {
      provide: StorageService,
      useClass: LocalStorageService,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
