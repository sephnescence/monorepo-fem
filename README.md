# Monorepo FEM

A TypeScript monorepo demonstrating serverless AWS architecture with least-privilege IAM roles, OIDC authentication, and infrastructure as code.

## What is this?

Following along with various FEM courses:

1. [TypeScript Monorepos: Architect Maintainable Codebases](https://frontendmasters.com/courses/monorepos-v2/) - Mike North
1. [Cursor & Claude Code: Professional AI Setup](https://frontendmasters.com/courses/pro-ai/) - Steve Kinney

## Mission

Communication skills are the future of software engineering. This project explores using AI (primarily Claude) to build empathy for different roles and communicate more effectively across product, engineering, and business contexts.

By creating a team of subagents, I'm developing a practice of explicitly reasoning about architectural decisions - treating AI as a conversation partner rather than a code generator.

**Core principles:**

- **Documentation over memorisation** - Design for unknown future maintainers
- **Testing & monitoring are non-negotiable** - Observability outlasts individual tenure
- **Leverage AI for velocity, not shortcuts** - Always understand the "why" behind decisions
- **Communication scales; implementation details don't** - Understanding users and articulating trade-offs matters more than implementation details

## Quick Start

**For new developers:** See [DEVELOPER_ONBOARDING.md](./docs/DEVELOPER_ONBOARDING.md)

**For contributors:** See [CONTRIBUTING.md](./CONTRIBUTING.md)

**Prerequisites:**
```sh
# Install pnpm
npm install -g pnpm

# Install dependencies
pnpm install

# Run tests
pnpm lerna run lint,build,test
```

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

## Architecture

**Applications:**
- heartbeat-publisher - Scheduled Lambda publishing heartbeat events
- pulse-publisher - Scheduled Lambda publishing pulse events
- scryscraper - Web scraping Lambda

**Environments:** dev, exp, prod

**Security model:** Per-app, per-environment IAM roles with OIDC authentication (9 deployment roles + 3 policy manager roles)

**Branch strategy:** `main` → `deploy-dev` → `deploy-exp` → `deploy-prod`

**Documentation:**
- [AWS_OIDC_SETUP.md](./docs/AWS_OIDC_SETUP.md) - OIDC authentication overview
- [BOOTSTRAP_IAM_ROLES.md](./docs/BOOTSTRAP_IAM_ROLES.md) - Infrastructure setup
- [POLICY_MANAGEMENT.md](./docs/POLICY_MANAGEMENT.md) - IAM policy management
- [devops/README.md](./devops/README.md) - Infrastructure details and bootstrap process
- [TROUBLESHOOTING_DEPLOYMENTS.md](./docs/TROUBLESHOOTING_DEPLOYMENTS.md) - Common issues
- [ADR_IAM_ROLE_SPLIT.md](./docs/ADR_IAM_ROLE_SPLIT.md) - Architecture decision record
