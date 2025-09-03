# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is an AWS CDK construct library for deploying Hugo static websites with CI/CD pipelines on AWS. It provides an all-in-one infrastructure-as-code solution using AWS CDK and CDK Pipelines, with development and production stages for Hugo sites hosted on S3 behind CloudFront.

## Common Development Commands

### Building and Testing
```bash
# Build the project (managed by projen)
npm run build

# Run tests
npm run test

# Watch mode for tests
npm run test:watch

# Lint code
npm run eslint

# Generate API documentation
npm run docgen

# Package for publishing
npm run package

# Run AWS CDK linting (checks API.md)
npm run awslint

# Run integration tests
npm run integ-test
```

### Projen Workflow
This project uses [projen](https://github.com/projen/projen) for project management:
```bash
# Update projen configuration (after modifying .projenrc.ts)
npm run projen

# View all available commands
npx projen --help
```

### Development Server (for Hugo themes)
```bash
# Start Hugo development server
npm run dev
```

### Release and Publishing
```bash
# Bump version
npm run bump

# Create release
npm run release

# Prepare for commit (runs Husky hooks)
npm run prepare
```

## Code Architecture

### Core Components

#### HugoPipeline (`src/hugoPipeline.ts`)
- **Purpose**: Main construct that orchestrates the entire CI/CD pipeline for Hugo sites
- **Key Features**:
  - Creates CodeCommit repository for source code
  - Sets up CodePipeline with build stages for development and production
  - Manages deployment to both dev and prod environments
  - Integrates with Route53 for custom domains
  - Supports basic authentication for development stage

#### HugoHosting (`src/hugoHosting.ts`)
- **Purpose**: Core hosting infrastructure construct
- **Key Features**:
  - S3 bucket for static site hosting
  - CloudFront distribution with SSL/TLS certificates
  - Route53 DNS configuration
  - Custom CloudFront functions for redirects and basic auth
  - Automated SSL certificate provisioning via ACM

### Project Structure
```
src/
├── index.ts              # Main exports
├── hugoPipeline.ts       # CI/CD pipeline construct
└── hugoHosting.ts        # Static hosting infrastructure

test/
├── hugoPipeline.test.ts  # Pipeline tests
└── hugoHosting.test.ts   # Hosting tests
```

### Key Design Patterns

1. **Multi-Stage Deployment**: Automatic deployment to both development (with basic auth) and production environments
2. **Domain Management**: Integration with Route53 for custom domain configuration
3. **Security**: SSL certificates, basic auth for development, and CloudFront security headers
4. **Customization**: Support for custom CloudFront functions and redirect rules

## Development Workflow

### Making Changes
1. Edit source code in `src/`
2. Run tests: `npm run test`
3. Build the project: `npm run build`
4. Update API docs: `npm run docgen` (auto-generated)
5. Run linting: `npm run eslint`
6. Check AWS CDK best practices: `npm run awslint`

### Adding New Features
1. Create feature branch from `main`
2. Implement changes following existing patterns
3. Add unit tests in `test/`
4. Update integration tests if needed
5. Build and test locally
6. Submit PR with clear description

### Testing Strategy
- **Unit Tests**: Jest-based tests for individual constructs
- **Integration Tests**: AWS CDK integration tests (integ-runner)
- **API Validation**: awslint checks for CDK best practices
- **Type Safety**: Full TypeScript with strict mode enabled

### Git Hooks and Quality Gates
- **Pre-commit**: Runs linting and formatting checks
- **Commit-msg**: Enforces conventional commit format
- **GitHub Actions**: Automated CI/CD with build, test, and release workflows

## Build System Details

### TypeScript Configuration
- **Source**: `src/` directory compiled to `lib/`
- **Target**: ES2020 with CommonJS modules
- **Strict Mode**: Enabled with comprehensive type checking
- **JSII**: Multi-language support for AWS CDK constructs

### Package Management
- **Manager**: Yarn Classic
- **Registry**: npm with public access
- **Versioning**: Automated via conventional commits and GitHub Actions

### AWS CDK Integration
- **Version**: 2.177.0
- **Target Languages**: Generated via JSII for multiple languages
- **Dependencies**: aws-cdk-lib, constructs, cdk-nag for security validation

## Domain-Specific Knowledge

### Hugo Integration
- Supports both development and production Hugo configurations
- Expects `blog/` directory with Hugo source code
- Builds to separate output directories: `public-development` and `public-production`
- Compatible with Hugo themes as Git submodules

### AWS Services Used
- **CodeCommit**: Git repository hosting
- **CodePipeline**: CI/CD automation
- **CodeBuild**: Build environment with Docker
- **S3**: Static website hosting
- **CloudFront**: CDN with custom functions
- **Route53**: DNS management
- **ACM**: SSL certificate provisioning
- **IAM**: Secure access management

### CloudFront Customizations
- Support for custom redirect rules via regex patterns
- Basic authentication for development environments
- Custom CloudFront functions for request/response processing
- SPA routing support (index.html fallbacks)

## Troubleshooting Common Issues

### Docker Build Issues
- If tests fail with "docker exited with status 1": `docker system prune -f`
- Ensure Docker is running before executing integration tests

### CodePipeline Failures
- Initial deployment creates repository and pipeline, which will fail
- Push code to CodeCommit after initial deployment
- Use `git branch -m master main` to align with expected branch name

### JSII Build Issues
- Use the provided Docker container for multi-language builds
- Clean `node_modules` when switching between host and container environments

## Security Considerations

- Uses cdk-nag for security validation
- Implements least-privilege IAM policies
- Enforces HTTPS for all web traffic
- Basic authentication configurable for development environments
- Secrets and sensitive data should never be committed to the repository