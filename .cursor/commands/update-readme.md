# Review Current State and Update README

Conduct a comprehensive review of the project and update the README.md to reflect any new features, material changes, or improvements to the project.

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
- **Check documentation files**
  - Review any existing markdown documentation (e.g., AUTHENTICATION.md)
  - Note features documented elsewhere that should be in README
- **Examine test coverage**
  - Check for new test files or testing patterns
  - Note any E2E tests or integration tests

### 2. Identify Changes

Compare your findings with the current README.md:

- **New Features**: Identify features that exist in code but aren't documented
- **Updated Features**: Find features that have changed significantly
- **Removed Features**: Note deprecated or removed functionality
- **Configuration Changes**: Identify new environment variables or setup requirements
- **API Changes**: Document new endpoints or modified request/response formats
- **Technology Stack Updates**: Note major dependency or framework upgrades

### 3. Update README

Update the README.md with your findings:

- **Maintain existing structure**: Keep the current organization and formatting style
- **Update sections**: Modify only sections that need changes
- **Add new sections**: Create new sections if major features warrant them
- **Keep examples current**: Update code examples to reflect current API
- **Update version numbers**: Ensure versions match package.json
- **Verify accuracy**: Cross-check all claims against actual code
- **Preserve tone**: Keep the professional, developer-friendly tone

### 4. Quality Checks

Before finalizing:

- ✓ All code examples are syntactically correct
- ✓ All file paths referenced actually exist
- ✓ Environment variables match `.env.example`
- ✓ API endpoints match actual controller routes
- ✓ Technology versions are accurate
- ✓ Links to external resources are working
- ✓ Formatting is consistent (spacing, bullets, code blocks)

### 5. Report Changes

After updating the README, provide a summary of:

- What sections were added
- What sections were modified
- What information was corrected or clarified
- Any notable features that were added to documentation
- Recommendations for additional documentation if needed

## Expected Outcome

A comprehensive, accurate, and up-to-date README.md that:

- Reflects the current state of the project
- Documents all major features and capabilities
- Provides accurate setup and usage instructions
- Helps new developers quickly understand and use the project
