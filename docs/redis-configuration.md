# Cache Configuration with READ/WRITE Pattern

This document explains how to configure cache with separate read and write connections in your NestJS application.

## Environment Variables

### Required Configuration

```bash
# Write connection (for primary/master)
REDIS_WRITE_URL=rediss://redis-write.example.com:6379

# Read connection (for read replicas) - optional
REDIS_READ_URL=rediss://redis-read.example.com:6379
```

### Optional Configuration

```bash
# Shared credentials for both connections
REDIS_USERNAME=username
REDIS_PASSWORD=password

# Database number (defaults to 0 if not set)
REDIS_DB=0

# Global cache TTL (in milliseconds)
CACHE_TTL=604800000  # 7 days
```

### Fallback Behavior

If `REDIS_READ_URL` is not set, the system will automatically use `REDIS_WRITE_URL` for both read and write operations.

## URL Formats

- **Non-TLS**: `redis://hostname:port`
- **TLS**: `rediss://hostname:port` (note the double 's')

## Usage Examples

### Basic Cache Operations

```typescript
import { CacheService } from './modules/cache/cache.service';

@Injectable()
export class UserService {
  constructor(private readonly cacheService: CacheService) {}

  async getUser(userId: string) {
    // Read operation - uses READ client
    const cached = await this.cacheService.get(`user:${userId}`);
    if (cached) return cached;

    // Fetch from database...
    const user = await this.userRepository.findOne(userId);

    // Write operation - uses WRITE client
    await this.cacheService.set(`user:${userId}`, user, 3600000);

    return user;
  }
}
```

### Batch Operations

```typescript
// Batch read - uses READ client
const users = await this.cacheService.mget(['user:1', 'user:2', 'user:3']);

// Batch write - uses WRITE client
await this.cacheService.mset([
  { key: 'user:1', value: user1, ttl: 3600000 },
  { key: 'user:2', value: user2, ttl: 3600000 },
]);
```

## Architecture Benefits

1. **Load Distribution**: Read operations are distributed across read replicas
2. **High Availability**: Write operations go to primary, reads can use replicas
3. **Performance**: Better read performance with multiple read endpoints
4. **Scalability**: Easy to add more read replicas without code changes
5. **Fault Tolerance**: If read replicas fail, writes still work

## Health Checks

The health endpoint will show the status of both connections:

```json
{
  "status": "ok",
  "details": {
    "cache": {
      "status": "up",
      "message": "Cache read: up, write: up",
      "details": {
        "read": true,
        "write": true
      }
    }
  }
}
```

## Migration from Single Redis

1. Update your environment variables to use `REDIS_WRITE_URL`
2. Optionally add `REDIS_READ_URL` for read replicas
3. The application will automatically use separate connections
4. Your existing code will continue to work without changes

## Connection Lifecycle and Error Handling

The cache services now include improved connection handling with the following features:

### Connection Management

- **Explicit Connection**: Redis clients are explicitly connected during module initialization
- **Connection Verification**: The `ping()` method verifies connection status before operations
- **Automatic Reconnection**: Built-in reconnection handling for network interruptions
- **Event Logging**: Connection events (connect, reconnecting, end) are logged for monitoring

### Error Handling

- **Structured Logging**: All errors include classification tags for better observability
- **Connection Errors**: Specific error handling for Redis connection failures
- **Service Errors**: Keyv store errors are caught and logged with context
- **Ping Errors**: Connection verification errors are properly handled and logged

### Logging Classifications

The following error classifications are used for monitoring:

- `redis_read_connect_error`: Read client connection failures
- `redis_write_connect_error`: Write client connection failures
- `cache_read_service_error`: Read service operation errors
- `cache_write_service_error`: Write service operation errors
- `redis_read_ping_error`: Read client ping failures
- `redis_write_ping_error`: Write client ping failures

## Troubleshooting

### Connection Issues

- Check that both Redis instances are accessible
- Verify URL format (redis:// vs rediss://)
- Ensure proper authentication credentials
- Review connection logs for specific error classifications
- Check if Redis clients are properly connecting during startup

### Performance Issues

- Monitor read/write latency separately
- Check if read replicas are properly syncing with primary
- Verify load balancing is working correctly
- Review connection event logs for reconnection patterns

### Debugging Connection Problems

1. **Check Logs**: Look for connection-related log messages during startup
2. **Verify Configuration**: Ensure Redis URLs and credentials are correct
3. **Test Connectivity**: Use the health check endpoint to verify both connections
4. **Monitor Events**: Watch for reconnection events in the logs
