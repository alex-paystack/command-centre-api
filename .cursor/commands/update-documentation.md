# Review Current State and Update Documentation

Conduct a comprehensive review of the project and update the documentation to reflect any new features, material changes, or improvements.

## Documentation Structure

The project documentation is organized as follows:

- `README.md` — High-level overview, quick start, and links to detailed docs
- `docs/architecture.md` — Core services, project structure, technology stack
- `docs/ai-features.md` — Chat modes, tools, charting, guardrails, context enrichment
- `docs/api-reference.md` — Complete endpoint documentation
- `docs/database.md` — MongoDB collections and migrations
- `docs/configuration.md` — Environment variables and rate limiting
- `docs/deployment.md` — Docker, CI/CD, production checklist
- `docs/contributing.md` — Code style, adding features, troubleshooting
- `docs/authentication.md` — JWT implementation details
- `docs/error-handling.md` — Error patterns and best practices

## Instructions

### 1. Review Project State

Perform a thorough analysis of the current project:

- **Examine the codebase structure**
  - Review `src/` directory organization
  - Check for new modules, services, or features
  - Identify any architectural changes
- **Analyze package dependencies**
  - Check `package.json` for new or updated dependencies
  - Note any significant framework or library version changes
- **Review configuration files**
  - Check `.env.example` for new environment variables
  - Review Docker/deployment configurations
  - Examine any CI/CD workflow files
- **Inspect API endpoints and features**
  - List all controllers and their endpoints
  - Identify new or modified API functionality
  - Check for new DTOs, entities, or validation rules
- **Check AI features**
  - Review tools in `src/common/ai/tools.ts`
  - Check for new aggregation types in `chart-config.ts`
  - Identify new prompts or classification logic
- **Examine test coverage**
  - Check for new test files or testing patterns
  - Note any E2E tests or integration tests

### 2. Identify Changes

Compare your findings with the current documentation:

- **New Features**: Identify features that exist in code but aren't documented
- **Updated Features**: Find features that have changed significantly
- **Removed Features**: Note deprecated or removed functionality
- **Configuration Changes**: Identify new environment variables or setup requirements
- **API Changes**: Document new endpoints or modified request/response formats
- **Technology Stack Updates**: Note major dependency or framework upgrades
- **AI Tool Changes**: New tools, modified parameters, or changed behavior

### 3. Update Documentation

Update the appropriate documentation files:

| Change Type                          | Update In                |
| ------------------------------------ | ------------------------ |
| New/changed services                 | `docs/architecture.md`   |
| AI tools, chat modes, charting       | `docs/ai-features.md`    |
| API endpoints                        | `docs/api-reference.md`  |
| Database schema, migrations          | `docs/database.md`       |
| Environment variables, rate limiting | `docs/configuration.md`  |
| Docker, CI/CD, deployment            | `docs/deployment.md`     |
| Code style, troubleshooting          | `docs/contributing.md`   |
| Authentication changes               | `docs/AUTHENTICATION.md` |
| Error handling patterns              | `docs/error-handling.md` |
| Overview, quick start                | `README.md`              |

**Guidelines:**

- **Keep README concise**: It should remain a high-level overview with links
- **Update specific docs**: Put detailed information in the appropriate doc file
- **Maintain consistency**: Follow existing formatting and style in each file
- **Keep examples current**: Update code examples to reflect current API
- **Update version numbers**: Ensure versions match package.json
- **Verify accuracy**: Cross-check all claims against actual code
- **Update diagrams**: Keep Mermaid diagrams accurate if architecture changes

### 4. Quality Checks

Before finalizing:

- ✓ All code examples are syntactically correct
- ✓ All file paths referenced actually exist
- ✓ Environment variables match `.env.example`
- ✓ API endpoints match actual controller routes
- ✓ Technology versions are accurate
- ✓ Links between docs are working
- ✓ Mermaid diagrams render correctly
- ✓ Tables are properly formatted
- ✓ Formatting is consistent across all docs

### 5. Report Changes

After updating documentation, provide a summary of:

- Which documentation files were updated
- What sections were added or modified in each file
- What information was corrected or clarified
- Any notable features that were added to documentation
- Recommendations for additional documentation if needed
- Any diagrams that were added or updated

## Expected Outcome

Comprehensive, accurate, and up-to-date documentation that:

- Reflects the current state of the project
- Documents all major features and capabilities
- Provides accurate setup and usage instructions
- Helps new developers quickly understand and use the project
- Is well-organized across focused documentation files
