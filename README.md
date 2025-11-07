# Monorepo FEM

Following along with various FEM courses over time:

1. [TypeScript Monorepos: Architect Maintainable Codebases](https://frontendmasters.com/courses/monorepos-v2/) - Mike North
1. [Cursor & Claude Code: Professional AI Setup](https://frontendmasters.com/courses/pro-ai/) - Steve Kinney

## Mission

Communication skills are the future of software engineering. This project explores using AI (primarily Claude) to build empathy for different roles and communicate more effectively across product, engineering, and business contexts

By creating a team of subagents, I'm developing a practice of explicitly reasoning about architectural decisions - treating AI as a conversation partner rather than a code generator

**Core principles:**

- **Documentation over memorisation** - Civil engineers design for unknown future maintainers. Will I remember everything after 5-10 years? I should design for that future maintainer, too. It's gonna be me (Awful throwback haha)
- **Testing & monitoring are non-negotiable** - Observability outlasts individual tenure
- **Leverage AI for velocity, not shortcuts** - Always understand the "why" behind decisions. Copy/pasting doesn't deepen understanding either. Stack Overflow may as well have been our first agent
- **Communication scales; implementation details don't** - Understanding users and articulating trade-offs matters more than implementation details

This approach aims to help me learn efficiently, reduce cognitive load, and work in a way that's more natural for my brain

## Spell Checking Configuration

This project uses a `cspell.json` configuration file for spell checking rather than committing `.vscode/settings.json`. Here's why:

**Portability & Team Consistency:**

- `cspell.json` is a standalone configuration file that works across different editors and tools (VS Code, Cursor, CLI, pre-commit hooks, CI/CD)
- This ensures consistent spell checking behaviour regardless of how developers use the project

**Language Configuration:**

- The project is configured for British English (`en-GB`), which aligns with Australian English spelling conventions
- CSS files are excluded from spell checking. CSS linters will have to handle styling-specific concerns
- Common colloquialisms (e.g., "haha", "gonna") are whitelisted to allow natural language in comments and documentation

## Package Manager Configuration

This repository enforces pnpm usage and blocks npm/yarn. Here's why and how it works:

**Enforcement mechanisms:**

- **Preinstall script** - Runs before any package manager installs dependencies, checking if pnpm is being used. If npm or yarn is detected, it exits with a clear error message
- **packageManager field** - Set to `pnpm@8.0.0` for Corepack support. If developers have Corepack enabled, Node.js will automatically enforce the correct package manager
- **Structural incompatibility** - pnpm uses a unique symlink-based node_modules structure that npm cannot parse. This provides an additional layer of protection against accidental npm usage

**Why pnpm?**

- Efficient disk space usage through content-addressable storage
- Faster installations via symlinks rather than copying files
- Strict dependency resolution prevents phantom dependencies (dependencies you use but don't declare)
- Better monorepo support

**Switching to npm (if needed):**

If pnpm doesn't work out and you need to migrate to npm:

1. Delete `node_modules` and `pnpm-lock.yaml`
2. Remove the `preinstall` script and `packageManager` field from `package.json`
3. Run `npm install` to generate a fresh `package-lock.json`

Note: The current node_modules structure cannot be read by npm due to pnpm's symlink architecture. A clean slate is required for migration.

**Using Claude:**

.claude/settings.local.json isn't committed, so please ensure you make your own. e.g.

```sh
{
  "permissions": {
    "allow": [
      "Bash(cat:*)",
      "Bash(find:*)",
      "Bash(pnpm build:*)",
      "Bash(pnpm install:*)",
      "Bash(pnpm test:*)"
    ],
    "deny": [],
    "ask": []
  }
}
```

Feel free to offer updates to this list

## Deployment Architecture

This repository uses a per-app, per-environment IAM role architecture for AWS deployments via GitHub Actions and OIDC authentication.

### Architecture Overview

- **3 Applications**: heartbeat-publisher, pulse-publisher, scryscraper
- **3 Environments**: dev, exp, prod
- **9 Deployment Roles**: One dedicated IAM role per application per environment
- **3 Policy Manager Roles**: One per environment for managing IAM policies

### Security Benefits

- **Least Privilege**: Each role can only access resources for its specific application
- **Blast Radius Reduction**: A compromised role cannot affect other applications
- **Environment Isolation**: Dev deployments cannot accidentally affect prod resources
- **Clear Audit Trail**: CloudTrail logs show exactly which app/environment was accessed

### Branch Strategy

Deployments are triggered by pushing to environment-specific branches:

- `deploy-dev` - Triggers deployments to the development environment
- `deploy-exp` - Triggers deployments to the experimental/staging environment
- `deploy-prod` - Triggers deployments to the production environment

The `main` branch does not trigger automatic deployments. To deploy:

1. Merge your changes to `main`
2. Merge `main` into the appropriate deployment branch
3. Push the deployment branch to trigger the deployment

You can also manually trigger deployments using workflow dispatch.

### Documentation

- **[AWS_OIDC_SETUP.md](./docs/AWS_OIDC_SETUP.md)** - Overview of OIDC authentication and multi-role architecture
- **[BOOTSTRAP_IAM_ROLES.md](./docs/BOOTSTRAP_IAM_ROLES.md)** - Step-by-step infrastructure setup guide
- **[POLICY_MANAGEMENT.md](./docs/POLICY_MANAGEMENT.md)** - How to manage and update IAM policies
- **[TESTING_PLAN_IAM_SPLIT.md](./docs/TESTING_PLAN_IAM_SPLIT.md)** - Testing strategy and validation
- **[TROUBLESHOOTING_DEPLOYMENTS.md](./docs/TROUBLESHOOTING_DEPLOYMENTS.md)** - Common deployment issues and solutions
- **[DEVELOPER_ONBOARDING.md](./docs/DEVELOPER_ONBOARDING.md)** - Guide for new team members
- **[ADR_IAM_ROLE_SPLIT.md](./docs/ADR_IAM_ROLE_SPLIT.md)** - Architecture decision record

### Quick Start for Deployments

1. **Bootstrap infrastructure** (one-time setup):
   ```sh
   # Deploy dev environment infrastructure
   aws cloudformation deploy \
     --template-file devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml \
     --stack-name monorepo-fem-devops-dev \
     --capabilities CAPABILITY_NAMED_IAM \
     --region ap-southeast-2
   ```

2. **Configure GitHub secrets** with role ARNs from CloudFormation outputs

3. **Deploy an application** by pushing to a deployment branch:
   ```sh
   git checkout main
   # Make changes
   git commit -m "Update application"
   git push

   # Merge to deployment branch
   git checkout deploy-dev
   git merge main
   git push  # This triggers the deployment
   ```

For detailed instructions, see [BOOTSTRAP_IAM_ROLES.md](./docs/BOOTSTRAP_IAM_ROLES.md).
