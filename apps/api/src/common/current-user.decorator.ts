import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export class UserPayload {
  userId!: string;
  email!: string;
  name?: string;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
