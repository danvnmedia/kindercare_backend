import { Injectable, Inject } from "@nestjs/common";
import { UserRepository, PaginatedUsers } from "../../ports/user.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

export interface GetAllUsersInput {
  page?: number;
  limit?: number;
  search?: string;
  ids?: string[];
  isActive?: boolean;
  roleIds?: string[];
  sortBy?: string;
  order?: "asc" | "desc";
}

@Injectable()
export class GetAllUsersUseCase {
  constructor(
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: GetAllUsersInput): Promise<PaginatedUsers> {
    const limit = input.limit ?? 20;
    const offset = input.page ? (input.page - 1) * limit : 0;
    const sort =
      input.sortBy && input.order
        ? `${input.sortBy}:${input.order}`
        : "createdAt:desc";

    const filters: { [key: string]: any } = {};
    if (input.search) {
      filters.OR = [
        {
          guardian: {
            OR: [
              { email: { contains: input.search, mode: "insensitive" } },
              { fullName: { contains: input.search, mode: "insensitive" } },
              { phoneNumber: { contains: input.search } },
            ],
          },
        },
        {
          teacher: {
            OR: [
              { email: { contains: input.search, mode: "insensitive" } },
              { fullName: { contains: input.search, mode: "insensitive" } },
              { phoneNumber: { contains: input.search } },
            ],
          },
        },
      ];
    }
    if (input.ids && input.ids.length > 0) {
      filters.id = { in: input.ids };
    }
    if (input.isActive !== undefined) {
      filters.isActive = input.isActive;
    }
    if (input.roleIds && input.roleIds.length > 0) {
      filters.userRoles = { some: { roleId: { in: input.roleIds } } };
    }

    const params: StandardRequest = {
      limit,
      offset,
      sort,
      filter:
        Object.keys(filters).length > 0 ? JSON.stringify(filters) : undefined,
    };

    return await this.userRepository.findAll(params);
  }
}
