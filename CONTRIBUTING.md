# Contributing

## Getting Started

See [DEVELOPER_ONBOARDING.md](./docs/DEVELOPER_ONBOARDING.md) for development environment setup.

## Architecture Rules

### Security

1. **Least Privilege** - IAM roles must only grant permissions necessary for their specific function
2. **Resource Scoping** - All IAM policies must scope permissions to `monorepo-fem-*` namespace
3. **Environment Isolation** - Resources must be environment-specific (dev/exp/prod)
4. **No Long-lived Credentials** - Use OIDC for GitHub Actions authentication
5. **Branch Protection** - OIDC trust policies must restrict to deployment branches only

### Infrastructure as Code

1. **CloudFormation First** - All infrastructure changes must go through CloudFormation templates
2. **No Manual Changes** - Do not manually modify AWS resources; update templates instead
3. **Version Control** - All infrastructure templates must be committed to git
4. **Consistent Naming** - Follow existing naming conventions (see [devops/README.md](./devops/README.md))

### Deployment

1. **Progressive Deployment** - Always deploy through dev → exp → prod sequence
2. **Test First** - Validate changes in dev before promoting to exp or prod
3. **No Direct Production** - Never deploy directly to prod; always go through lower environments
4. **Rollback Plan** - Understand rollback strategy before deploying

### Code Quality

1. **Linting** - All code must pass `pnpm lerna run lint`
2. **Build** - All code must successfully build with `pnpm lerna run build`
3. **Tests** - All tests must pass with `pnpm lerna run test`
4. **No Breaking Tests** - If tests break, work with maintainer to fix them; do not modify tests yourself

### Documentation

1. **Link to Source** - Reference actual source files instead of duplicating code examples
2. **Single Source of Truth** - Avoid duplicating information across multiple documents
3. **Clear and Concise** - Avoid fluff; state facts directly
4. **External References** - Link to official documentation where appropriate

## Workflow

1. Create feature branch from `main`
2. Make changes and commit
3. Run `pnpm lerna run lint,build,test` to validate
4. Push and create pull request to `main`
5. After merge to `main`, merge to deployment branches sequentially:
   - `main` → `deploy-dev`
   - `deploy-dev` → `deploy-exp`
   - `deploy-exp` → `deploy-prod`

## Adding a New Application

See [POLICY_MANAGEMENT.md](./docs/POLICY_MANAGEMENT.md) for detailed instructions.

**Summary:**
1. Create CloudFormation role resources in all environment templates
2. Define IAM policy scoped to application resources
3. Add GitHub secrets for role ARNs
4. Create GitHub Actions workflow
5. Test deployment in dev environment

## Adding Dependencies

**Always ask for permission before adding packages.** When requesting:

1. Identify the specific need
2. Research at least two alternative packages
3. Provide comparison: features, maintenance status, bundle size, licence
4. Explain why your recommendation is the best fit

## Style Guide

- **Language:** Australian English (en-AU)
- **Punctuation:** Use `-` not `—`
- **Colloquialisms:** Natural language is acceptable in comments and documentation
- **Spell Checking:** Use `cspell.json` configuration

## Testing

- **Never modify tests** without maintainer approval
- **Write tests** for new functionality
- **All tests must pass** before creating pull request

## Communication

- **Clear commit messages** - Explain why, not just what
- **Descriptive PR titles** - Summarise the change's purpose
- **Link to issues** - Reference related issues or ADRs
- **Trade-offs** - Document alternatives considered and reasoning

## Questions?

See [DEVELOPER_ONBOARDING.md](./docs/DEVELOPER_ONBOARDING.md) or reach out to maintainers.
