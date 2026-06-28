import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { Permission, PermissionEntity } from "@/domain/rbac";
import { PermissionRepository } from "../ports/permission.repository";

@Injectable()
export class GetPermissionsByModuleUseCase {
  private readonly logger = new Logger(GetPermissionsByModuleUseCase.name);

  constructor(
    @Inject("PERMISSION_REPOSITORY")
    private readonly permissionRepository: PermissionRepository,
  ) {}

  async execute(module: string): Promise<Permission[]> {
    this.logger.log(`Getting permissions for module: ${module}`);

    try {
      PermissionEntity.validateModule(module);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid module",
      );
    }

    return await this.permissionRepository.findByModule(module);
  }
}
