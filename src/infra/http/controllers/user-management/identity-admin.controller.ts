import { User } from "@/domain/user-management/user.entity";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { DeleteGlobalIdentityUseCase } from "@/application/user-management/use-cases/user/delete-global-identity.use-case";
import { LockGlobalIdentityUseCase } from "@/application/user-management/use-cases/user/lock-global-identity.use-case";
import { UnlockGlobalIdentityUseCase } from "@/application/user-management/use-cases/user/unlock-global-identity.use-case";
import { Controller, Delete, Param, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../../decorators";
import { ClerkAuthGuard, GlobalAdminGuard } from "../../guards";

@Controller("identity-admin/users")
@ApiTags("Identity Admin")
@ApiBearerAuth("JWT")
@ApiResponse({
  status: 401,
  description: "Missing, invalid, or inactive authenticated identity.",
})
@ApiResponse({
  status: 403,
  description: "Authenticated user is not a global super admin.",
})
@UseGuards(ClerkAuthGuard, GlobalAdminGuard)
export class IdentityAdminController {
  constructor(
    private readonly lockGlobalIdentityUseCase: LockGlobalIdentityUseCase,
    private readonly unlockGlobalIdentityUseCase: UnlockGlobalIdentityUseCase,
    private readonly deleteGlobalIdentityUseCase: DeleteGlobalIdentityUseCase,
  ) {}

  @Post(":id/lock")
  @StandardResponse({
    message: "Global identity locked",
    type: null,
  })
  @ApiOperation({
    summary: "Lock a global identity",
    description:
      "Locks the Clerk identity and sets the internal User inactive. Requires a global system role.",
  })
  async lock(@Param("id") id: string, @CurrentUser() currentUser: User) {
    await this.lockGlobalIdentityUseCase.execute(id, currentUser);
  }

  @Post(":id/unlock")
  @StandardResponse({
    message: "Global identity unlocked",
    type: null,
  })
  @ApiOperation({
    summary: "Unlock a global identity",
    description:
      "Unlocks the Clerk identity and sets the internal User active without restoring archived profiles. Requires a global system role.",
  })
  async unlock(@Param("id") id: string, @CurrentUser() currentUser: User) {
    await this.unlockGlobalIdentityUseCase.execute(id, currentUser);
  }

  @Delete(":id")
  @StandardResponse({
    message: "Global identity permanently deleted",
    type: null,
  })
  @ApiOperation({
    summary: "Permanently delete an unlinked global identity",
    description:
      "Deletes the Clerk identity and internal User only when no Staff or Guardian profile, active or archived, remains linked. Requires a global system role.",
  })
  @ApiResponse({
    status: 409,
    description:
      "The identity still has at least one linked Staff or Guardian profile.",
  })
  async delete(@Param("id") id: string, @CurrentUser() currentUser: User) {
    await this.deleteGlobalIdentityUseCase.execute(id, currentUser);
  }
}
