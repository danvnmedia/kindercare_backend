import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { Observable, map } from "rxjs";

type Ctor<T> = new (...args: any[]) => T;

@Injectable()
export class SerializeInterceptor<T> implements NestInterceptor {
  constructor(private readonly dto: Ctor<T>) {}

  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        if (data == null) return data;

        if (Array.isArray(data)) {
          return plainToInstance(this.dto, data, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true,
          });
        }

        if (typeof data === "object" && Array.isArray(data.items)) {
          return {
            ...data,
            items: plainToInstance(this.dto, data.items, {
              excludeExtraneousValues: true,
              enableImplicitConversion: true,
            }),
          };
        }

        if (typeof data === "object" && Array.isArray(data.data)) {
          return {
            ...data,
            data: plainToInstance(this.dto, data.data, {
              excludeExtraneousValues: true,
              enableImplicitConversion: true,
            }),
          };
        }
        console.log(
          "Data before plainToInstance:",
          JSON.stringify(data, null, 2),
        ); // Add this line
        return plainToInstance(this.dto, data, {
          excludeExtraneousValues: true,
          enableImplicitConversion: true,
        });
      }),
    );
  }
}
