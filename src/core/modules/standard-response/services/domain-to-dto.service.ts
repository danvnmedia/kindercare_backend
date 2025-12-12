import { Injectable } from "@nestjs/common";
import { plainToClass } from "class-transformer";

@Injectable()
export class DomainToDtoService {
  transformToDto<T>(domainEntity: any, dtoClass: new () => T): T {
    return plainToClass(dtoClass, {
      id: domainEntity.id,
      ...domainEntity.props,
    });
  }

  transformArrayToDto<T>(domainEntities: any[], dtoClass: new () => T): T[] {
    return domainEntities.map((entity) =>
      this.transformToDto(entity, dtoClass),
    );
  }

  transformPaginatedToDto<T>(
    paginatedResult: { data: any[]; [key: string]: any },
    dtoClass: new () => T,
  ): { data: T[]; [key: string]: any } {
    return {
      ...paginatedResult,
      data: this.transformArrayToDto(paginatedResult.data, dtoClass),
    };
  }
}
