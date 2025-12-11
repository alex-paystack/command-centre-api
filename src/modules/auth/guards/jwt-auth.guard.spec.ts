/* eslint-disable @typescript-eslint/unbound-method */
import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from '../auth.service';
import { APIError } from '../../../common';

interface RequestWithUser extends Request {
  user?: {
    userId: string;
  };
}

describe('JwtAuthGuard', () => {
  const mockRequestFactory = (headers: Record<string, string | undefined>, path = '/chat'): RequestWithUser =>
    ({
      path,
      headers,
    }) as unknown as RequestWithUser;

  const mockContextFactory = (req: RequestWithUser): ExecutionContext => {
    const getRequest = () => req;
    return {
      switchToHttp: () => ({ getRequest }),
    } as unknown as ExecutionContext;
  };

  let authService: jest.Mocked<AuthService>;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    authService = {
      validateToken: jest.fn(),
      extractUserId: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    guard = new JwtAuthGuard(authService);
  });

  it('allows excluded paths without auth', async () => {
    const req = mockRequestFactory({}, '/health');
    const ctx = mockContextFactory(req);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(authService.validateToken).not.toHaveBeenCalled();
  });

  it('throws when token is missing', async () => {
    const req = mockRequestFactory({ authorization: undefined });
    const ctx = mockContextFactory(req);

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(APIError);
  });

  it('attaches user on valid token', async () => {
    authService.validateToken.mockResolvedValue({ userId: 'user-1' });
    const req = mockRequestFactory({ authorization: 'Bearer valid' });
    const ctx = mockContextFactory(req);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toEqual({ userId: 'user-1' });
  });

  it('rethrows APIError from AuthService (expired token)', async () => {
    const apiError = new APIError('Expired', 'AUTH_EXPIRED', undefined, HttpStatus.UNAUTHORIZED);
    authService.validateToken.mockRejectedValue(apiError);

    const req = mockRequestFactory({ authorization: 'Bearer expired' });
    const ctx = mockContextFactory(req);

    await expect(guard.canActivate(ctx)).rejects.toBe(apiError);
  });
});
