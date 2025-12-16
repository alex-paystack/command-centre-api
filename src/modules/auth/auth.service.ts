import { Injectable, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ResponseCode } from '@paystackhq/pkg-response-code';
import { APIError } from '~/common';

interface JwtPayload {
  id: string;
  [key: string]: unknown;
}

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async validateToken(token: string) {
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

      return { userId: payload.id };
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

  async extractUserId(token: string) {
    const { userId } = await this.validateToken(token);
    return userId;
  }
}
