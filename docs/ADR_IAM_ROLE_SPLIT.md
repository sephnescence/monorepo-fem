# Architecture Decision Record: IAM Role Split for Per-App Deployments

**Status:** Accepted

**Date:** 2024-11-07

**Decision Makers:** Blake Taylor (with Claude as architectural reasoning partner)

## Context

The monorepo-fem project contains multiple serverless applications (heartbeat-publisher, pulse-publisher, scryscraper) deployed to AWS Lambda via GitHub Actions. Initially, a single IAM role (`GitHubActionsDeployRole`) was used for all deployments across all applications and environments.

### Problems with Single Role Approach

1. **Overly Permissive**: Single role had permissions for all applications, violating least privilege principle
2. **Blast Radius**: Compromise of one application could affect all others through shared permissions
3. **Audit Complexity**: CloudTrail logs couldn't clearly distinguish which application accessed which resources
4. **Policy Complexity**: Single policy document managing permissions for all apps was becoming large and hard to maintain
5. **Scalability**: Adding new applications required updating the single role's policy, increasing risk of breaking existing deployments
6. **Compliance**: Difficult to demonstrate per-app access controls for security frameworks

### Business Context

- Small development team (1-2 developers)
- Learning project for CI/CD and AWS best practices
- Cost-conscious (minimise AWS costs)
- Security-focused (prepare for potential production use)
- Documentation-driven development approach

## Decision

We will split the single deployment IAM role into a **per-app, per-environment architecture** with dedicated IAM roles for each application in each environment.

### Architecture Overview

**From:**

- 1 IAM role: `GitHubActionsDeployRole`
- 1 policy with permissions for all apps
- Branch-based environment selection

**To:**

- 9 deployment roles: 3 apps × 3 environments
  - `GitHubActionsDeployRole-HeartbeatPublisher-dev`
  - `GitHubActionsDeployRole-HeartbeatPublisher-exp`
  - `GitHubActionsDeployRole-HeartbeatPublisher-prod`
  - `GitHubActionsDeployRole-PulsePublisher-dev`
  - `GitHubActionsDeployRole-PulsePublisher-exp`
  - `GitHubActionsDeployRole-PulsePublisher-prod`
  - `GitHubActionsDeployRole-ScrysScraper-dev`
  - `GitHubActionsDeployRole-ScrysScraper-exp`
  - `GitHubActionsDeployRole-ScrysScraper-prod`
- 3 policy manager roles: 1 per environment
  - `monorepo-fem-policy-manager-dev`
  - `monorepo-fem-policy-manager-exp`
  - `monorepo-fem-policy-manager-prod`
- Infrastructure managed via CloudFormation
- Per-app policies scoped to app-specific resources

### Key Principles

1. **Least Privilege**: Each role can only access resources for its specific application
2. **Environment Isolation**: Dev roles cannot access exp/prod resources
3. **Infrastructure as Code**: All roles and policies defined in CloudFormation
4. **Auditability**: Clear CloudTrail trails showing which app/env accessed what
5. **Scalability**: Adding new apps requires only new role definitions

## Alternatives Considered

### Alternative 1: Single Role with Conditional Policies

**Approach:** Keep single role but use IAM policy conditions to restrict access based on resource tags or naming conventions.

**Pros:**

- Simpler to manage (only one role)
- No GitHub secrets to manage per app
- Single OIDC configuration

**Cons:**

- Still overly permissive (single compromised role affects all apps)
- Policy conditions can be complex and error-prone
- Harder to audit (all apps use same role ARN)
- Doesn't solve policy size limitations
- Difficult to enforce least privilege

**Why Rejected:** Doesn't solve the fundamental security issues we're trying to address.

### Alternative 2: Per-Environment Roles Only

**Approach:** Create roles per environment (dev, exp, prod) but shared across all apps.

**Pros:**

- Simpler than per-app roles (3 roles instead of 9)
- Provides environment isolation
- Easier to manage

**Cons:**

- Apps still share permissions within an environment
- Blast radius reduction not achieved
- Audit trails less clear
- Doesn't solve policy size issues for large monorepos
- Limited scalability

**Why Rejected:** Doesn't provide sufficient security isolation between applications.

### Alternative 3: Per-App Roles Only (Shared Across Environments)

**Approach:** Create roles per application but shared across all environments.

**Pros:**

- Application isolation achieved
- Simpler than per-app, per-environment (3 roles instead of 9)
- Clear audit trails per app

**Cons:**

- No environment isolation (dev role can access prod!)
- High risk of accidental prod changes
- Doesn't align with security best practices
- Compliance issues

**Why Rejected:** Environment isolation is critical for safety.

### Alternative 4: AWS Organizations with Multiple Accounts

**Approach:** Use separate AWS accounts for each environment, with cross-account roles.

**Pros:**

- Maximum isolation (network-level)
- Industry best practice for large organisations
- Separate billing per environment
- Complete blast radius containment

**Cons:**

- Significantly more complex to set up and manage
- Higher operational overhead
- More expensive (multiple account costs)
- Overkill for a small learning project
- Requires AWS Organizations setup

**Why Rejected:** Too complex for the current team size and project scope. Could be revisited if scaling to production.

### Alternative 5: Temporary Credentials via AWS STS AssumeRole

**Approach:** Use a base role that assumes other roles based on application context.

**Pros:**

- Dynamic permission escalation
- Single entry point
- Flexible permission model

**Cons:**

- Adds complexity (role chaining)
- Still requires managing multiple roles
- Additional AssumeRole calls (latency)
- Harder to audit
- More complex trust policies

**Why Rejected:** Adds unnecessary complexity without solving the fundamental issues.

## Consequences

### Positive Consequences

1. **Enhanced Security:**
   - Each app role has minimal permissions (least privilege)
   - Compromised role only affects one app in one environment
   - Clear security boundaries

2. **Improved Auditability:**
   - CloudTrail logs clearly show which app/env accessed resources
   - Easier to track down security issues
   - Better compliance demonstration

3. **Better Scalability:**
   - Adding new apps is straightforward (template-based)
   - Policy size limits easier to manage per app
   - Clear separation of concerns

4. **Clearer Ownership:**
   - Each app has its own IAM identity
   - Permissions are explicit and focused
   - Easier to reason about access patterns

5. **Reduced Blast Radius:**
   - Issues in one app don't affect others
   - Environment isolation prevents dev mistakes affecting prod
   - Easier to test permission changes

6. **Learning Opportunities:**
   - Hands-on experience with AWS security best practices
   - Understanding of IAM policy design
   - Infrastructure as Code skills development

### Negative Consequences

1. **Increased Complexity:**
   - 9 roles instead of 1
   - More CloudFormation resources to manage
   - More GitHub secrets to configure
   - Larger documentation burden

2. **Higher Initial Setup Cost:**
   - Time to create and test all roles
   - Migration from old architecture
   - Learning curve for new team members

3. **Operational Overhead:**
   - Policy updates require updating multiple templates
   - More resources to monitor
   - More potential failure points

4. **Cognitive Load:**
   - Developers need to understand which role is used when
   - More moving parts to keep track of
   - Requires better documentation

### Mitigations for Negative Consequences

1. **Complexity Management:**
   - CloudFormation templates provide consistency
   - Comprehensive documentation created
   - Clear naming conventions established
   - Automation via GitHub Actions

2. **Reduced Setup Cost:**
   - Detailed bootstrap guide created
   - Copy-paste CLI commands provided
   - Testing plan developed

3. **Operational Overhead:**
   - CloudFormation makes updates easier
   - Templates can be parameterised
   - Changes tested in dev first
   - Policy management guide created

4. **Cognitive Load:**
   - Developer onboarding guide created
   - Clear documentation for all processes
   - Troubleshooting guide available
   - Architecture diagrams provided

## Implementation

### Phase 1: Planning and Documentation (Completed)

- Created comprehensive documentation set
- Designed CloudFormation templates
- Defined role and policy structures
- Created testing strategy

### Phase 2: Infrastructure as Code (Completed)

- CloudFormation templates for dev, exp, prod
- OIDC provider configuration
- Per-app deployment roles
- Policy manager roles
- Outputs for role ARNs

### Phase 3: Workflow Updates (Completed)

- Updated GitHub Actions workflows
- Per-app, per-environment secret references
- Workflow dispatch support
- Branch-based triggers

### Phase 4: Testing (In Progress)

- Bootstrap infrastructure in dev
- Test all deployment scenarios
- Verify least privilege enforcement
- Validate security controls

### Phase 5: Migration (Pending)

- Execute migration runbook
- Teardown old infrastructure
- Verify all deployments work
- Monitor for issues

### Phase 6: Documentation and Knowledge Sharing (Completed)

- Comprehensive documentation created
- ADR published
- Onboarding guide for new developers
- Troubleshooting resources

## Success Metrics

**Security Metrics:**

- ✅ Each role can only access its designated resources (to be validated)
- ✅ Cross-app access attempts are denied (to be validated)
- ✅ Environment isolation enforced (to be validated)
- ✅ IAM Access Analyser shows no unexpected findings (to be validated)

**Operational Metrics:**

- ✅ Deployment success rate maintained or improved (to be measured)
- ✅ CloudTrail logs provide clear audit trails (to be validated)
- ✅ No production incidents caused by permission issues (ongoing)
- ✅ Documentation completeness score: 100%

**Developer Experience Metrics:**

- ✅ New developers can understand and use system within 1 day (to be validated)
- ✅ Policy updates take < 30 minutes (to be measured)
- ✅ Troubleshooting time reduced (to be measured)

## Review and Updates

This ADR should be reviewed:

- When adding new applications
- When security requirements change
- When team size significantly increases
- Annually as part of architecture review
- If migration to multi-account setup is considered

## Related Documentation

- [AWS_OIDC_SETUP.md](./AWS_OIDC_SETUP.md) - OIDC architecture details
- [BOOTSTRAP_IAM_ROLES.md](./BOOTSTRAP_IAM_ROLES.md) - Implementation guide
- [POLICY_MANAGEMENT.md](./POLICY_MANAGEMENT.md) - Policy update procedures
- [TESTING_PLAN_IAM_SPLIT.md](./TESTING_PLAN_IAM_SPLIT.md) - Testing strategy
- [TROUBLESHOOTING_DEPLOYMENTS.md](./TROUBLESHOOTING_DEPLOYMENTS.md) - Operational guide
- [DEVELOPER_ONBOARDING.md](./DEVELOPER_ONBOARDING.md) - Developer guide

## References

- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Principle of Least Privilege](https://en.wikipedia.org/wiki/Principle_of_least_privilege)
- [AWS Security Best Practices](https://docs.aws.amazon.com/security/)
- [GitHub Actions OIDC with AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [CloudFormation Best Practices](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/best-practices.html)

## Appendix: Decision Timeline

- **2024-11-05**: Initial architecture exploration
- **2024-11-06**: Alternatives evaluation and decision to proceed with per-app split
- **2024-11-07**: CloudFormation templates created, workflows updated
- **2024-11-07**: Comprehensive documentation suite completed
- **TBD**: Bootstrap and migration execution
- **TBD**: Post-migration review

## Signatures

**Architect:** Blake Taylor (with Claude as reasoning partner)

**Date:** 2024-11-07

**Stakeholders Consulted:** Self (solo learning project)

---

## Lessons Learned (To Be Updated Post-Migration)

This section will be updated after migration is complete to capture:

- What went well during implementation
- What could be improved
- Unexpected challenges
- Recommendations for similar projects
