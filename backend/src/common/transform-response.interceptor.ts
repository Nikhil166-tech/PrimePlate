import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { HttpException } from '@nestjs/common';

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        message: 'Success',
        data,
      })),
      catchError((err) => {
        const response = {
          success: false,
          message: err.message || 'Error',
          errors: err.getResponse?.()?.message
            ? [err.getResponse()?.message]
            : [],
        };
        throw new HttpException(response, err.getStatus?.() ?? 500);
      }),
    );
  }
}
