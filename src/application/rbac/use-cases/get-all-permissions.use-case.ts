import { Injectable, Inject, Logger } from "@nestjs/common";
import { Permission } from "@/domain/rbac";
import { PermissionRepository } from "../ports/permission.repository";

@Injectable()
export class GetAllPermissionsUseCase {
  private readonly logger = new Logger(GetAllPermissionsUseCase.name);

  constructor(
    @Inject("PERMISSION_REPOSITORY")
    private readonly permissionRepository: PermissionRepository,
  ) {}

  async execute(): Promise<Permission[]> {
    this.logger.log("Getting all permissions");

    return await this.permissionRepository.findAll();
  }
}
