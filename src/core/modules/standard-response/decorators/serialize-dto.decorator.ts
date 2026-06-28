import { UseInterceptors, applyDecorators } from "@nestjs/common";
import { SerializeInterceptor } from "../interceptors/serialize.interceptor";

export const SerializeDTO = <T>(dto: new (...args: any[]) => T) =>
  applyDecorators(UseInterceptors(new SerializeInterceptor(dto)));
