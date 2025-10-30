import { applyDecorators, UseInterceptors, Type } from '@nestjs/common';
import { StandardResponse, StandardResponseOptions } from './standard-response.decorator';
import { SerializeInterceptor } from '../interceptors/serialize.interceptor';

export function StandardResponseWithDTO<T>(
    dtoClass: Type<T>,
    options: Omit<StandardResponseOptions, 'type'>
) {
    const combinedOptions: StandardResponseOptions = {
        ...options,
        type: dtoClass
    };

    return applyDecorators(
        StandardResponse(combinedOptions),
        UseInterceptors(new SerializeInterceptor(dtoClass))
    );
}
