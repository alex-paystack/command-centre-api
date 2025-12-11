<h1 align="center">
  A Paystack Project
</h1>

# Command Centre API

API for the AI powered merchant dashboard

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## 🔧 Automatic pnpm Setup

This template uses **corepack** (built into Node.js 16.13+) to automatically manage pnpm without requiring global installation.

### How it works:

1. **Corepack Integration**: The `package.json` includes `"packageManager": "pnpm@9.15.0"` which tells corepack which version to use
2. **Automatic Setup**: The initialization script runs `corepack enable` to make pnpm available
3. **No Global Installation**: pnpm is managed locally per project, ensuring version consistency

### Benefits:

- ✅ **No global pnpm installation required**
- ✅ **Version consistency** across team members
- ✅ **Automatic version management** via corepack
- ✅ **Works with any Node.js 16.13+ installation**

### Manual Setup (if needed):

If you prefer to set up pnpm manually:

```bash
# Enable corepack (Node.js 16.13+)
corepack enable

# Or install pnpm globally (alternative)
npm install -g pnpm

# Install dependencies
pnpm install
```

## 📁 Project Structure

```
src/
├── config/             # Configuration files
├── database/           # Database module (optional)
├── modules/            # Feature modules
├── app.controller.ts   # Main application controller
├── app.service.ts      # Main application service
├── app.module.ts       # Root module configuration
└── main.ts            # Application entry point
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Application
NODE_ENV=development
PORT=3000

# Service Information
APP_NAME=command-centre-api
APP_VERSION=1.0.0

# Observability
LOG_LEVEL=info
METRICS_ENABLED=true
TRACING_ENABLED=true

# Optional: Redis Cache
REDIS_WRITE_URL=redis://localhost:6379
REDIS_READ_URL=redis://localhost:6379
REDIS_PASSWORD=

# Optional: MySQL Database
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=user
MYSQL_PASSWORD=password
MYSQL_DB=nestjs_app
DB_SYNC=false
DB_LOGGING=false

# Optional: MongoDB
MONGO_URI=mongodb://localhost:27017
MONGO_DB=nestjs_app

# OpenTelemetry (Optional)
# Service identification
OTEL_SERVICE_NAME=command-centre-api
OTEL_SERVICE_VERSION=1.0.0
OTEL_SERVICE_ENV=local

# OpenTelemetry Exporters (none, console, otlp)
OTEL_LOGS_EXPORTER=console
OTEL_TRACES_EXPORTER=console
OTEL_METRICS_EXPORTER=console

# OTLP Endpoints (only needed if using otlp exporters)
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:4318/v1/logs
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics
OTEL_EXPORTER_OTLP_HEADERS=authorization=Bearer your-token

# Tracing
OTEL_TRACES_SAMPLER=always_on
OTEL_TRACES_SAMPLER_ARG=1.0
OTEL_SPAN_ATTRIBUTE_SANITIZATION_ENABLED=true
```

## 🎯 Available Scripts

```bash
# Development
pnpm run start:dev      # Start development server with hot reload
pnpm run start:debug    # Start with debug mode
pnpm run start:prod     # Start production server

# Building
pnpm run build          # Build the application
pnpm run build:watch    # Build with watch mode

# Testing
pnpm run test           # Run unit tests
pnpm run test:watch     # Run tests in watch mode
pnpm run test:cov       # Run tests with coverage
pnpm run test:e2e       # Run end-to-end tests

# Code Quality
pnpm run lint           # Run ESLint
pnpm run format         # Format code with Prettier
pnpm run lint:fix       # Fix ESLint issues automatically

# Git Hooks
pnpm run prepare        # Setup Husky hooks
```

## 🗄️ Database & Cache Modules

### Enabling Optional Modules

The template includes optional database and cache modules that are commented out by default.

#### Cache Module (Redis)

1. **Configure Redis** in your `.env`:

   ```env
   REDIS_WRITE_URL=redis://localhost:6379
   REDIS_READ_URL=redis://localhost:6379
   REDIS_PASSWORD=
   REDIS_USERNAME=
   ```

2. **Usage**:

   ```typescript
   import { CacheService } from './infrastructure/cache';

   constructor(private cacheService: CacheService) {}

   // Cache a value
   await this.cacheService.set('key', 'value', 300);

   // Get from cache
   const value = await this.cacheService.get('key');
   ```

See [Cache Module Documentation](./src/infrastructure/cache/README.md) for detailed usage.

#### Database Module (MySQL + MongoDB)

1. **Configure databases** in your `.env`:

   ```env
   # MySQL
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=user
   MYSQL_PASSWORD=password
   MYSQL_DB=nestjs_app

   # MongoDB (optional)
   MONGO_URI=mongodb://localhost:27017
   MONGO_DB=nestjs_app
   ```

2. **Usage**:

   ```typescript
   import { DatabaseService } from './infrastructure/database';

   constructor(private databaseService: DatabaseService) {}

   // MySQL operations
   const userRepo = this.databaseService.getRepository(User);
   const users = await userRepo.find();

   // MongoDB operations
   const collection = this.databaseService.getMongoCollection('users');
   const documents = await collection.find().toArray();
   ```

See [Database Module Documentation](./src/infrastructure/database/README.md) for detailed usage.

## 📊 Observability

The application includes comprehensive observability features:

### Metrics

- **Endpoint**: `/metrics` (Prometheus format)
- **Default metrics**: CPU, memory, HTTP requests, etc.
- **Custom metrics**: Add your own business metrics

### Logging

- **Structured logging** with correlation IDs
- **Console output** for development
- **OTLP export** for production (optional)

### Tracing

- **Distributed tracing** with OpenTelemetry
- **Automatic instrumentation** of HTTP requests
- **Custom spans** for business logic

### Health Checks

- **System health**: `/health`
- **Database connectivity**: `/health/database`
- **Cache connectivity**: `/health/cache`

## 🐳 Docker Support

> **Note**: Make sure Docker Desktop is running before using Docker commands. If you see "Cannot connect to the Docker daemon" errors, start Docker Desktop first.

### Development

```bash
# Option 1: Run only the application locally (recommended for development)
pnpm run start:dev

# Option 2: Run supporting services with Docker (databases, cache, monitoring)
docker-compose up --watch
pnpm run start:dev

# Option 3: Run everything in Docker (full containerized setup)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production

```bash
# Build image (with private package authentication)
docker build --build-arg NPM_TOKEN=your_github_token -t command-centre-api .

# Build image (using public packages)
cp package.json.public package.json
docker build -t command-centre-api .

# Run container
docker run -p 3000:3000 command-centre-api
```

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm run test:cov

# Run specific test file
pnpm test app.service.spec.ts
```

### E2E Tests

```bash
# Run E2E tests
pnpm run test:e2e

# Run E2E tests in watch mode
pnpm run test:e2e --watch
```

### Test Structure

```
test/
├── app.controller.e2e-spec.ts     # End-to-end tests
src/
├── app.controller.spec.ts
├── app.service.spec.ts
└── infrastructure/
    └── system/
        ├── system.controller.spec.ts
        └── system.service.spec.ts
```

## 🔒 Security

### Environment Variables

- Never commit `.env` files
- Use different configurations for different environments
- Validate environment variables on startup

### Dependencies

- Regular security audits: `pnpm audit`
- Keep dependencies updated
- Use lock files for reproducible builds

## 🚀 Deployment

### CI/CD Setup

This template includes a production-grade CI/CD pipeline with GitHub Actions. To enable it:

1. **Add GitHub Secrets** (required for private packages):

   ```bash
   # Go to your GitHub repository → Settings → Secrets and variables → Actions
   # Add the following secret:
   PERSONAL_ACCESS_TOKEN=your_github_token_with_read_packages_scope
   ```

   **Note**: This token is required because the template uses private GitHub packages like `@paystackhq/nestjs-observability`.

2. **Enable the CI/CD Pipeline**:
   - The pipeline will automatically run on pushes to `main`, `develop`, and `staging` branches
   - It will also run on pull requests to these branches
   - The pipeline includes: linting, testing, security audits, and Docker builds

3. **Pipeline Features**:
   - ✅ Code formatting and linting checks
   - ✅ Unit tests with 60% coverage threshold
   - ✅ E2E tests with comprehensive scenarios
   - ✅ Security vulnerability scanning
   - ✅ Docker image building with caching
   - ✅ Coverage reporting to Codecov (optional)

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production database credentials
- [ ] Set up proper logging and monitoring
- [ ] Configure reverse proxy (nginx, etc.)
- [ ] Set up SSL/TLS certificates
- [ ] Configure backup strategies
- [ ] Set up CI/CD pipelines
- [ ] Add `PERSONAL_ACCESS_TOKEN` to GitHub secrets

### Environment-Specific Configs

```bash
# Development
cp .env.example .env

# Staging
cp .env.example .env.staging

# Production
cp .env.example .env.production
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Style

- Follow ESLint configuration
- Use Prettier for formatting
- Write meaningful commit messages
- Add JSDoc comments for public APIs

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [Redis Documentation](https://redis.io/documentation)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)

## 📄 License

This project is licensed under the UNLICENSED license - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

1. Check the documentation in each module
2. Review the test examples
3. Check existing issues
4. Create a new issue with detailed information

## 🔧 Troubleshooting

### Private Package Issues

**"ERR_PNPM_FETCH_401 Unauthorized" or "Cannot install @paystackhq/nestjs-observability"**

This template uses private GitHub packages that require authentication. You have several options:

#### Option 1: Use GitHub Personal Access Token (Recommended)

```bash
# For local development
export NPM_TOKEN=your_github_token_with_read_packages_scope
pnpm install

# For Docker builds
docker build --build-arg NPM_TOKEN=your_token -t your-app .

# For CI/CD (GitHub Actions)
# Add PERSONAL_ACCESS_TOKEN secret in your repository settings
```

#### Option 2: Create .npmrc file

```bash
echo '//npm.pkg.github.com/:_authToken=your_token' > .npmrc
echo '@paystackhq:registry=https://npm.pkg.github.com' >> .npmrc
pnpm install
```

#### Option 3: Use public version (Limited functionality)

```bash
cp package.json.public package.json
pnpm install
```

**Note**: The `PERSONAL_ACCESS_TOKEN` is required for the CI/CD pipeline to work properly. Make sure to add it to your GitHub repository secrets.

### Docker Issues

**"Cannot connect to the Docker daemon"**

- Make sure Docker Desktop is running
- On macOS/Windows: Start Docker Desktop application
- On Linux: Run `sudo systemctl start docker`

**"Port already in use"**

- Stop existing services: `docker-compose down`
- Check for running containers: `docker ps`
- Kill conflicting processes or change ports in docker-compose files

**"Permission denied"**

- On Linux, you might need to run Docker commands with `sudo`

### Application Issues

**"Module not found"**

- Make sure dependencies are installed: `pnpm install`
- Check if modules are properly imported in `app.module.ts`

**"Database connection failed"**

- Ensure database services are running: `docker-compose -f docker-compose.dev.yml ps`
- Check environment variables in `.env` file
- Verify database credentials and connection strings

**"Cache not working"**

- Ensure Redis is running: `docker ps | grep redis`
- Check Redis configuration in `.env` file
- Verify cache module is enabled in `app.module.ts`

---

**Built with ❤️ by Paystack**
