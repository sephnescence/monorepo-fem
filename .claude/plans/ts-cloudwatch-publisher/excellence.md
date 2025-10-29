# Definition of Excellence: CloudWatch Publisher Docker Image

## Purpose

This document defines the criteria for excellence when creating a lean Docker image that publishes metrics to AWS CloudWatch every minute using bash. This definition will be used to evaluate the quality and completeness of implementation plans and the resulting deliverable.

## Core Requirements

### 1. Docker Image Design

**Excellent implementation:**

- Uses Alpine Linux or similar minimal base image (< 50MB base size)
- Final image size is optimised (< 100MB total)
- Only installs essential packages required for the task
- Uses multi-stage builds if necessary to minimise final image size
- No unnecessary development tools or dependencies in final image

**Reasoning:** Lean images reduce attack surface, deployment time, and infrastructure costs. Alpine Linux provides a minimal yet functional base suitable for bash scripting.

### 2. CloudWatch Integration

**Excellent implementation:**

- Uses AWS CLI or lightweight alternative for publishing metrics
- Properly authenticates using IAM roles or environment variables (never hardcoded credentials)
- Handles errors gracefully (network failures, authentication issues, throttling)
- Publishes meaningful metrics with proper namespace, dimensions, and units
- Includes retry logic with exponential backoff for transient failures

**Reasoning:** Reliable metric publishing requires robust error handling. AWS best practices mandate secure credential management. Proper metric structure ensures observability value.

### 3. Scheduling Mechanism

**Excellent implementation:**

- Uses cron within the container to execute script every minute
- Cron configuration is properly documented and validated
- Script execution is logged appropriately (stdout/stderr)
- Container runs continuously without requiring external orchestration
- Handles timezone considerations explicitly - Using UTC in all cases

**Reasoning:** Self-contained scheduling simplifies deployment. Proper logging enables troubleshooting. Explicit timezone handling prevents confusion.

### 4. Bash Script Quality

**Excellent implementation:**

- Script uses proper error handling (set -e, set -u, set -o pipefail)
- Clear, readable code with comments explaining non-obvious logic
- Validates required environment variables before execution
- Outputs structured logs (timestamp, status, metric details)

**Reasoning:** Robust bash scripts prevent silent failures. Good practices make scripts maintainable. Independent testability accelerates development.

### 5. Documentation & Actionability

**Excellent implementation:**

- Comprehensive README explaining what the image does and why
- Step-by-step instructions using CLI tools (docker build, docker run)
- All required environment variables documented with examples
- Prerequisites clearly stated (AWS credentials, required permissions)
- Troubleshooting guide for common issues
- Examples show exact commands with explanations of each argument
- Explains which arguments to use and which to avoid, with reasoning

**Reasoning:** Any team member should be able to build, run, and troubleshoot the solution without deep Docker or AWS expertise. CLI-driven approach ensures reproducibility.

### 6. Configuration & Flexibility

**Excellent implementation:**

- Metric name, namespace, and dimensions configurable via environment variables
- Interval configurable by environment variable (not hardcoded to one minute)
- Sensible defaults with clear documentation on how to override
- Validation of configuration values before use

**Reasoning:** Flexible configuration enables reuse across different environments and use cases. Validation prevents runtime failures due to misconfiguration.

### 7. Security Considerations

**Excellent implementation:**

- Runs as non-root user within container
- No secrets baked into image
- Minimal installed packages reduce vulnerability surface
- Clear documentation on IAM permissions required (principle of least privilege)
- Uses official base images from trusted sources

**Reasoning:** Security is non-negotiable in production systems. Non-root execution limits blast radius of potential compromises. Explicit permission documentation enables proper access control.

### 8. Operational Characteristics

**Excellent implementation:**

- Container starts successfully and runs indefinitely
- Graceful shutdown handling (responds to SIGTERM)
- Health check endpoint or mechanism
- Resource limits documented and reasonable
- Logs are container-friendly (stdout/stderr, not files)

**Reasoning:** Production containers must be reliable and observable. Proper shutdown prevents data loss. Health checks enable orchestration. Stdout logging integrates with container log drivers.

## Plan Quality Criteria

### Comprehensive Reasoning

**Excellent plans include:**

- Explicit explanation of why each step is necessary
- Discussion of alternatives considered and why they were rejected
- Architecture decision records for non-obvious choices
- Clear connection between requirements and implementation decisions

### CLI-First Approach

**Excellent plans:**

- Specify exact CLI commands to execute
- Explain each argument and flag used
- Provide examples of expected output
- Warn against common pitfalls or incorrect arguments
- Never instruct direct file creation when CLI tools exist (e.g. use `pnpm init`, not manual `package.json` creation instructions)

### Accessibility

**Excellent plans:**

- Assume no prior deep expertise in Docker or AWS
- Define technical terms on first use
- Provide context for why certain tools or approaches are chosen
- Include verification steps after each major action
- Anticipate and address common questions or confusion points

## Success Metrics

An excellent implementation will demonstrate:

1. Docker image builds successfully on first attempt
2. Container runs continuously without crashes
3. Metrics appear in CloudWatch within 2 minutes of container start
4. Any team member can follow the plan and achieve same result
5. Solution is maintainable (someone else can understand and modify it)
6. All edge cases have defined, predictable behaviour

## Anti-Patterns to Avoid

- Hardcoding values that should be configurable
- Running as root unnecessarily
- Silent failures (swallowing errors)
- Unclear or missing documentation
- Overly complex solutions when simple ones suffice
- Installing packages "just in case" without clear need
- Creating files directly instead of using appropriate CLI tools
- Plans that skip reasoning or assume reader knowledge

## Evaluation Framework

When grading work against this definition:

- **Core Requirements:** All 8 categories must be addressed
- **Plan Quality:** Reasoning must be comprehensive and accessible
- **Completeness:** Nothing left to guesswork or assumption
- **Practicality:** Can a junior engineer execute the plan successfully?
- **Enablement:** Can a non-engineer execute the plan successfully?
- **Maintainability:** Can someone else understand and modify the result?

This definition prioritises clarity, security, reliability, and accessibility over clever implementations or premature optimisation.
