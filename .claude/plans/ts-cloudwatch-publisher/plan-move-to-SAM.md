# Migration Plan: CloudWatch Log Publisher to AWS SAM + TypeScript Lambda

## Overview

Migrate the existing Docker-based CloudWatch log publisher (`packages/cloudwatch-publisher/`) to a TypeScript Lambda function orchestrated by AWS SAM, with EventBridge for scheduling.

**Why SAM over Docker:**

- Cost: Pay only for Lambda execution time (per-second billing) vs continuous container runtime
- Scalability: AWS manages runtime, no container orchestration needed
- Maintenance: No Docker image updates, AWS maintains Node.js runtime
- Native AWS Integration: EventBridge scheduling built-in, no cron daemon required

---

## Work Checklist

### Phase 1: Project Structure Setup

- [ ] Create `packages/ts-cloudwatch-publisher/` directory
- [ ] Create `packages/ts-cloudwatch-publisher/package.json` with:
  - `type: "module"` for ESM
  - Dependencies: `@aws-sdk/client-cloudwatch-logs`
  - Dev dependencies: `typescript`, `@types/node`, `@types/aws-lambda`, `esbuild`
  - Build script: `esbuild src/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.mjs --format=esm`
- [ ] Create `packages/ts-cloudwatch-publisher/tsconfig.json` with:
  - `module: "ES2022"`
  - `target: "ES2022"`
  - `moduleResolution: "bundler"`
  - `strict: true` (no `any` types)
- [ ] Create `packages/ts-cloudwatch-publisher/src/` directory for TypeScript code
- [ ] Create `packages/ts-cloudwatch-publisher/.gitignore` (ignore `node_modules/`, `dist/`, `.aws-sam/`)

### Phase 2: TypeScript Lambda Handler

- [ ] Create `packages/ts-cloudwatch-publisher/src/index.ts` with:
  - Proper imports from AWS SDK v3 (`@aws-sdk/client-cloudwatch-logs`)
  - Type-safe handler signature (EventBridge scheduled event)
  - No `any` types anywhere
  - Error handling with try/catch and meaningful error messages
  - Console logging showing what's being published
  - Idempotent implementation (safe to run repeatedly)
- [ ] Implement CloudWatch Logs publishing logic:
  - Create CloudWatch Logs client
  - Use `PutLogEventsCommand` from AWS SDK v3
  - Read log group name and log stream name from environment variables
  - Generate timestamped log stream name (e.g., `heartbeat-YYYY-MM-DD-HH-MM-SS`)
  - Publish structured JSON log objects with consistent schema
  - Include timestamp, message type, and any relevant metadata
- [ ] Add proper error handling:
  - Catch SDK errors and log them clearly
  - Handle missing environment variables
  - No silent failures

### Phase 3: AWS SAM Template

- [ ] Create `packages/ts-cloudwatch-publisher/template.yaml` with:
  - Valid SAM syntax (Transform: AWS::Serverless-2016-10-31)
  - Parameters section (optional: environment name, schedule rate)
  - CloudWatch Log Group resource:
    - Logical ID: `TargetLogGroup`
    - Log group name: `/monorepo-fem/ts-heartbeat`
    - Retention period: 7 days
  - Lambda Function resource:
    - Logical ID: `CloudWatchPublisherFunction`
    - Runtime: `nodejs20.x`
    - Handler: `dist/index.handler`
    - CodeUri: `.`
    - Timeout: 30 seconds
    - Environment variables:
      - `LOG_GROUP_NAME: !Ref TargetLogGroup`
      - `LOG_STREAM_PREFIX: heartbeat`
    - Policies:
      - `logs:CreateLogStream` scoped to target log group ARN
      - `logs:PutLogEvents` scoped to target log group ARN
  - EventBridge Schedule resource:
    - Logical ID: `PublisherSchedule`
    - Schedule expression: `rate(1 minute)`
    - Target: CloudWatchPublisherFunction
    - Enabled: true
- [ ] Validate template with `sam validate`

### Phase 4: Build Process

- [ ] Ensure `esbuild` is configured to:
  - Bundle all dependencies
  - Target Node.js 20
  - Output ESM format (`.mjs`)
  - Place output in `dist/` directory
- [ ] Verify `sam build` can successfully build the Lambda
- [ ] Verify build output includes `dist/index.mjs` with handler function

### Phase 5: Documentation

- [ ] Create `packages/ts-cloudwatch-publisher/README.md` explaining:
  - What the Lambda does (publishes heartbeat logs to CloudWatch)
  - Prerequisites (AWS CLI, SAM CLI, Node.js 20+)
  - How to build: `npm install && npm run build && sam build`
  - How to deploy: `sam deploy --guided`
  - What resources are created (Lambda, EventBridge rule, CloudWatch log group, IAM role)
  - How to verify it's working:
    - Check Lambda execution logs in CloudWatch
    - Check target log group for published logs
    - Verify EventBridge rule is enabled
  - How to modify the schedule (change `rate(1 minute)` in template)
  - How to clean up: `sam delete`
- [ ] Add architectural decision documentation:
  - Why SAM over Docker (cost, maintenance, scalability)
  - Why TypeScript over JavaScript (type safety, better IDE support)
  - Why AWS SDK v3 (tree-shaking, smaller bundle sizes)
  - Why EventBridge over cron (managed service, no daemon)
- [ ] Add inline code comments explaining:
  - EventBridge event structure
  - CloudWatch Logs API requirements (sequence tokens, log stream creation)
  - Why we use timestamped log streams

### Phase 6: Testing

- [ ] Test locally with `sam local invoke CloudWatchPublisherFunction --event events/eventbridge-event.json`
- [ ] Create `packages/ts-cloudwatch-publisher/events/eventbridge-event.json` with sample EventBridge scheduled event
- [ ] Test build process: `npm run build` completes without TypeScript errors
- [ ] Test SAM build: `sam build` completes successfully
- [ ] Deploy to AWS: `sam deploy --guided`
- [ ] Verify deployment:
  - Lambda function created
  - EventBridge rule created and enabled
  - Target log group created with 7-day retention
  - IAM role created with correct permissions
- [ ] Verify execution:
  - Wait for scheduled execution (1 minute)
  - Check Lambda logs in CloudWatch
  - Check target log group for published logs
  - Confirm no permission errors

### Phase 7: Migration Cleanup

- [ ] Archive Docker implementation:
  - Move `packages/cloudwatch-publisher/` to `packages/cloudwatch-publisher-docker-deprecated/`
  - Add note in `packages/cloudwatch-publisher-docker-deprecated/README.md` explaining deprecation
  - Reference new SAM implementation location
- [ ] Update main `README.md` if it references the Docker implementation
- [ ] Confirm functional parity: New Lambda publishes logs at same frequency (every 1 minute)

### Phase 8: Final Verification Against Excellence Criteria

- [ ] AWS SAM Template:
  - [ ] Passes `sam validate`
  - [ ] CloudWatch log group explicitly defined with 7-day retention
  - [ ] Lambda configured with Node.js 20.x runtime
  - [ ] EventBridge schedule configured for `rate(1 minute)`
  - [ ] IAM permissions complete and minimal (scoped to specific log group)
  - [ ] Environment variables configured (log group name, log stream prefix)
  - [ ] Clear resource naming (logical IDs indicate purpose)
- [ ] TypeScript Lambda Code:
  - [ ] Type safety enforced (no `any` types)
  - [ ] Error handling with try/catch and meaningful messages
  - [ ] AWS SDK v3 CloudWatch Logs client used correctly
  - [ ] Proper Lambda handler signature (EventBridge scheduled event)
  - [ ] Idempotent (safe to run repeatedly)
  - [ ] Console logging shows what's being published
- [ ] Project Structure:
  - [ ] Lambda code in dedicated `packages/ts-cloudwatch-publisher/` directory
  - [ ] `package.json` with correct dependencies and `type: "module"`
  - [ ] `tsconfig.json` with ESM module system (ES2022)
  - [ ] Clear build process using esbuild
  - [ ] Docker implementation archived/deprecated
- [ ] Deployment & Testing:
  - [ ] `sam build` succeeds without errors
  - [ ] `sam deploy --guided` works with clear prompts
  - [ ] Can test locally with `sam local invoke`
  - [ ] Observability confirmed:
    - [ ] Lambda execution logs visible
    - [ ] Target log group receives published logs
    - [ ] No permission errors
- [ ] Documentation:
  - [ ] README explains what Lambda does
  - [ ] README explains how to build and deploy
  - [ ] README explains what resources are created
  - [ ] README explains how to verify it's working
  - [ ] Architectural decision documented (SAM over Docker)
  - [ ] Scheduling explanation included (EventBridge)
- [ ] Migration Completeness:
  - [ ] Functional parity achieved (same log publishing frequency)
  - [ ] Old Docker files archived and marked deprecated
  - [ ] No breaking changes (standalone project, no external consumers)

---

## Success Metrics

After completing this plan, I should be able to:

1. ✅ Run `sam build && sam deploy` and have a working Lambda publishing logs
2. ✅ See logs published to `/monorepo-fem/ts-heartbeat` every minute
3. ✅ Confirm scheduled execution via EventBridge in AWS Console
4. ✅ Understand all IAM permissions and their scope
5. ✅ Modify schedule or runtime configuration without manual infrastructure changes

---

## Grading Against Definition of Excellence

### Initial Self-Assessment (Draft 1)

| Category               | Items Met | Total Items | Percentage | Status          |
| ---------------------- | --------- | ----------- | ---------- | --------------- |
| AWS SAM Template       | 0/7       | 7           | 0%         | Not Started     |
| TypeScript Lambda Code | 0/6       | 6           | 0%         | Not Started     |
| Project Structure      | 0/5       | 5           | 0%         | Not Started     |
| Deployment & Testing   | 0/7       | 7           | 0%         | Not Started     |
| Documentation          | 0/6       | 6           | 0%         | Not Started     |
| Migration Completeness | 0/3       | 3           | 0%         | Not Started     |
| **Overall**            | **0/34**  | **34**      | **0%**     | **Not Started** |

**Grade: Not Started**

**Notes:**

- This is a comprehensive plan covering all excellence criteria
- Plan includes detailed checklists for each phase
- Plan is ready for execution
- Once implementation begins, this grading section will be updated
- Plan quality itself: Excellent (covers all requirements, clear steps, proper breakdown)

---

## Implementation Order Rationale

1. **Phase 1 (Structure)** - Foundation must be in place first
2. **Phase 2 (Lambda Code)** - Core functionality before infrastructure
3. **Phase 3 (SAM Template)** - Infrastructure definition after code structure is clear
4. **Phase 4 (Build)** - Ensure build process works before deploying
5. **Phase 5 (Documentation)** - Document as we build, not after
6. **Phase 6 (Testing)** - Validate everything works end-to-end
7. **Phase 7 (Cleanup)** - Only archive old implementation after new one is proven
8. **Phase 8 (Verification)** - Final check against excellence criteria

---

## Technical Decisions

| Decision          | Choice           | Rationale                           |
| ----------------- | ---------------- | ----------------------------------- |
| Runtime           | Node.js 20.x     | Latest LTS, native ESM support      |
| Module System     | ESM              | Modern standard, better for Lambda  |
| Build Tool        | esbuild          | Fast, simple, good Lambda support   |
| SDK Version       | AWS SDK v3       | Smaller bundles, modular imports    |
| Schedule          | rate(1 minute)   | Match existing Docker frequency     |
| Log Retention     | 7 days           | Balance cost vs debugging needs     |
| Log Stream Naming | Timestamped      | Unique per execution, sortable      |
| IAM Scope         | Log group ARN    | Principle of least privilege        |
| Error Strategy    | Bubble to Lambda | Let AWS retry logic handle failures |

---

## Risk Mitigation

| Risk                            | Mitigation                                                      |
| ------------------------------- | --------------------------------------------------------------- |
| Breaking existing functionality | Archive Docker version, don't delete immediately                |
| IAM permission errors           | Test locally first, use CloudFormation outputs for verification |
| Build process complexity        | Use simple esbuild with minimal config                          |
| TypeScript compilation errors   | Enable strict mode from start, catch issues early               |
| Deployment failures             | Use `sam deploy --guided` for interactive parameter validation  |
| Missing logs in target group    | Add extensive console logging to debug permissions              |

---

## Definition of Excellence: Plan Quality Self-Assessment

Does this plan meet the excellence criteria?

**Completeness:** ✅ Yes

- All 6 excellence categories addressed (SAM template, TypeScript code, project structure, deployment, documentation, migration)
- All 34 checklist items from excellence definition included
- Additional detail and breakdown provided

**Clarity:** ✅ Yes

- Clear phases with logical ordering
- Specific tasks with concrete outputs
- No ambiguous "implement feature" items

**Actionability:** ✅ Yes

- Each checkbox is a discrete, completable task
- Technical specifications provided (runtime versions, module systems, etc.)
- Commands and file paths specified

**Traceability:** ✅ Yes

- Phase 8 maps directly to excellence criteria
- Grading rubric included
- Success metrics defined

**Decision Documentation:** ✅ Yes

- Technical decisions table explains choices
- Architectural rationale included (SAM vs Docker)
- Risk mitigation strategies listed

**Plan Grade: Excellent (95%)**

Minor improvements possible:

- Could add estimated time for each phase
- Could include specific test assertions
- Could add troubleshooting section

**Ready for Execution: Yes**

This plan meets the definition of excellence for planning documentation and is ready to be executed step by step.
