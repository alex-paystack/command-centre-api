# JWT Authentication Implementation

This document describes the JWT authentication system implemented in the Command Centre API.

## Overview

All API endpoints (except `/health`) are protected with JWT authentication. The JWT token must be sent in the `Authorization` header with the `Bearer` scheme.

## Configuration

### Environment Variables

Add the following to your `.env` file:

```env
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h
```

**Important**: Use a strong, random secret key in production. You can generate one using:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## JWT Token Format

### Required Claims

Your JWT token must include the following claim:

- `id` - The user's unique identifier

### Example JWT Payload

```json
{
  "id": "user_12345",
  "iat": 1234567890,
  "exp": 1234654290
}
```

## Making Authenticated Requests

### Request Format

Include the JWT token in the Authorization header:

```http
GET /chat/conversations
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Example using cURL

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/chat/conversations
```

### Example using JavaScript/Fetch

```javascript
fetch('http://localhost:3000/chat/conversations', {
  headers: {
    Authorization: 'Bearer ' + jwtToken,
  },
});
```

## Swagger UI Testing

The Swagger UI at `/swagger` includes an "Authorize" button at the top right. Click it and enter your JWT token (without the "Bearer" prefix) to test authenticated endpoints.

## Protected Endpoints

All `/chat` endpoints are now protected and automatically use the authenticated user's ID:

- `POST /chat/conversations` - Creates a conversation for the authenticated user
- `GET /chat/conversations` - Gets all conversations for the authenticated user (no userId parameter needed)
- `GET /chat/conversations/:id` - Gets a specific conversation
- `DELETE /chat/conversations` - Deletes all conversations for the authenticated user
- `DELETE /chat/conversations/:id` - Deletes a specific conversation
- `POST /chat/messages` - Creates messages in a conversation
- `GET /chat/messages/:conversationId` - Gets messages in a conversation
- `POST /chat/stream` - Streams AI chat responses for the authenticated user

## Excluded Endpoints

The following endpoints do **not** require authentication:

- `/health` - Health check endpoint

## Error Responses

### Missing Token (401)

```json
{
  "status": false,
  "message": "Missing authentication token",
  "type": "api_error",
  "code": "access_denied"
}
```

### Invalid or Expired Token (401)

```json
{
  "status": false,
  "message": "Invalid or expired token",
  "type": "api_error",
  "code": "authentication_expired"
}
```

### Missing User ID in Token (401)

```json
{
  "status": false,
  "message": "Invalid token: missing user ID",
  "type": "api_error",
  "code": "access_denied"
}
```

## Implementation Details

### Architecture

The authentication system consists of:

1. **JwtAuthGuard** (`src/modules/auth/guards/jwt-auth.guard.ts`)
   - Global guard applied to all routes
   - Validates JWT tokens and extracts user ID
   - Allows excluded paths to bypass authentication

2. **AuthService** (`src/modules/auth/auth.service.ts`)
   - Provides methods to validate tokens and extract user IDs
   - Uses NestJS JwtService for token verification

3. **@CurrentUser() Decorator** (`src/modules/auth/decorators/current-user.decorator.ts`)
   - Custom parameter decorator to extract authenticated user ID in controllers
   - Usage: `@CurrentUser() userId: string`

4. **AuthModule** (`src/modules/auth/auth.module.ts`)
   - Configures JWT validation with secret from environment
   - Exports guard and service for use in other modules

### How It Works

1. Request arrives with `Authorization: Bearer <token>` header
2. JwtAuthGuard intercepts the request
3. Guard checks if path is excluded (e.g., `/health`)
4. If not excluded, extracts and validates JWT token
5. Extracts `id` claim from token payload
6. Attaches user info to request: `request.user = { userId: payload.id }`
7. Controllers use `@CurrentUser()` decorator to access the user ID
8. User ID is passed to services for business logic

### Files Created

- `src/modules/auth/auth.module.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/guards/jwt-auth.guard.ts`
- `src/modules/auth/decorators/current-user.decorator.ts`
- `src/config/jwt.config.ts`

### Files Modified

- `src/app.module.ts` - Added AuthModule and global guard
- `src/main.ts` - Added Bearer auth to Swagger
- `src/modules/chat/chat.service.ts` - Replaced hardcoded user ID with parameter
- `src/modules/chat/chat.controller.ts` - Uses @CurrentUser() decorator
- `src/modules/chat/dto/create-conversation.dto.ts` - Made userId optional
- Test files updated to mock authentication

## Testing

### Unit Tests

All unit tests have been updated to mock the JwtAuthGuard:

```bash
pnpm test
```

### Integration Testing

For integration tests, you'll need to provide a valid JWT token or mock the guard.

### Manual Testing

1. Generate a test JWT token with an `id` claim
2. Use the token in Swagger UI or API client
3. Verify endpoints work with valid tokens and reject invalid ones

## Security Considerations

1. **Secret Key**: Use a strong, random secret key in production
2. **Token Expiration**: Tokens should expire (default 24h)
3. **HTTPS**: Always use HTTPS in production to protect tokens in transit
4. **Token Storage**: Store tokens securely on the client (avoid localStorage for sensitive apps)
5. **Refresh Tokens**: Consider implementing refresh tokens for better UX

## Future Enhancements

- Add refresh token support
- Implement token blacklisting/revocation
- Add role-based access control (RBAC)
- Add API key authentication for service-to-service calls
