import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

interface RequestWithUser {
  user?: {
    userId: string;
  };
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  const userId = request.user?.userId;

  if (!userId) {
    throw new UnauthorizedException('User ID not found in request. Authentication required.');
  }

  return userId;
});
