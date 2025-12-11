import { Injectable, CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ResponseCode } from '@paystackhq/pkg-response-code';
import { Request } from 'express';
import { APIError } from '../../../common';

interface JwtPayload {
  id: string;
  [key: string]: unknown;
}

interface RequestWithUser extends Request {
  user?: {
    userId: string;
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly excludedPaths = ['/health', '/dummy'];

  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const path = request.path;

    if (this.isExcludedPath(path)) {
      return true;
    }

    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new APIError(
        'Missing authentication token',
        ResponseCode.ACCESS_DENIED,
        undefined,
        HttpStatus.UNAUTHORIZED,
      );
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      if (!payload.id) {
        throw new APIError(
          'Invalid token: missing user ID',
          ResponseCode.ACCESS_DENIED,
          undefined,
          HttpStatus.UNAUTHORIZED,
        );
      }

      request.user = { userId: payload.id };

      return true;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(
        'Invalid or expired token',
        ResponseCode.AUTHENTICATION_EXPIRED,
        undefined,
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private extractTokenFromHeader(request: Request) {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  private isExcludedPath(path: string) {
    return this.excludedPaths.some((excludedPath) => path.startsWith(excludedPath));
  }
}
