# PROMPT_042 — GeoChat Release Verification & Reliability

## 1. Project Context

GeoChat is a location-based social messaging application.

Technology stack:
- Backend: Java 21, Spring Boot 4.1.0, Maven Wrapper.
- Database: PostgreSQL 16 + PostGIS 16-3.4.
- Database migrations: Flyway.
- Web: React, TypeScript, Vite.
- Authentication: JWT.
- Realtime: WebSocket/STOMP.
- Web server/reverse proxy: Nginx.
- Containers: Docker Compose.
- CI: GitHub Actions.
- Architecture: Modular monolith.
- Development environment: Windows, Docker Desktop.
- Mobile development: Paused.

Confirmed completed milestones:
- PROMPT_036 — Nearby Discovery & Map UX.
- PROMPT_037 — Friend Discovery & Connection UX.
- PROMPT_038 — Chat Performance & Pagination Optimization.
- PROMPT_039 — Notifications & Realtime UX.
- PROMPT_040 — Security & Production Readiness.
- PROMPT_041 — Deployment & Monitoring Foundation.

The current repository is the source of truth.

## 2. Confirmed Existing Infrastructure

PROMPT_041 implemented:
- Backend multi-stage Docker image using Java 21.
- Non-root Backend runtime user.
- Web multi-stage Docker image using Node 22.12 and Nginx.
- Docker Compose services: web, backend, postgres.
- PostgreSQL/PostGIS persistent volume.
- Persistent chat image volume.
- Internal Docker networks.
- Nginx reverse proxy for REST and WebSocket.
- Production environment validation.
- Container health checks.
- Container log rotation.
- GitHub Actions CI workflow.
- Deployment documentation.
- Backup/restore documentation.
- Update and rollback documentation.

Do not recreate these features.

## 3. Already Verified — Do Not Reimplement

The user has manually executed:

docker compose --env-file .env config --quiet
docker compose --env-file .env build
docker compose --env-file .env up -d
docker compose ps

The application started successfully.

The user confirmed:
- GeoChat Web works through Docker Compose.
- Two accounts can send and receive chat messages.
- Realtime chat works through the containerized application.
- Backend was restarted with Docker Compose.
- After Backend restart, messaging resumed without refreshing the browser.

Treat these as successful manual verification results.

Do not claim they prove all possible WebSocket failure/reconnect scenarios.

Do not rewrite:
- Docker Compose architecture.
- Nginx routing.
- JWT authentication.
- Chat functionality.
- WebSocket reconnect logic.

Only modify these areas if a new reproducible defect is found.

---

# PART A — MANDATORY RULES

## 4. Audit Before Coding

Inspect:
- .github/workflows/ci.yml
- docker-compose.yml
- Backend Dockerfile
- Web Dockerfile
- Nginx configuration
- Existing health endpoints
- Existing backup/restore documentation
- Existing deployment documentation
- Existing tests
- Existing CI scripts
- Existing security configuration

Classify each item:
- ALREADY IMPLEMENTED.
- VERIFIED WORKING.
- NEEDS IMPROVEMENT.
- MISSING.
- NOT APPLICABLE.

Document findings before implementing changes.

Do not generate unnecessary code.

## 5. Web-first Scope

Primary scope:
- Deployment verification.
- Backend reliability.
- Web recovery behavior.
- CI reliability.
- Container security.
- Database backup and recovery.

Backend changes are allowed only when justified by verified defects.

Web changes are allowed only when justified by verified UX/recovery defects.

## 6. Mobile — Strictly Excluded

- Do not modify Mobile.
- Do not implement Mobile features.
- Do not build Mobile.
- Do not typecheck Mobile.
- Do not test Mobile.

Preserve existing Mobile-facing API contracts.

## 7. Non-goals

Do not implement:
- New chat features.
- New social features.
- Kubernetes.
- Redis.
- Kafka.
- Microservices.
- Public VPS deployment.
- Domain registration.
- Public HTTPS deployment.
- Cloud monitoring services.
- Full observability stack.
- Automatic production deployment.

Do not require a VPS or domain.

## 8. Data Safety — Critical

The user's local PostgreSQL database may contain valuable application data.

Never automatically:
- Run docker compose down -v.
- Delete Docker volumes.
- Drop existing databases.
- Reinitialize persistent storage.
- Restore over the existing database.
- Run destructive schema migrations.
- Remove chat image storage.
- Replace the user's .env.
- Print secrets to logs.

All destructive recovery tests must use disposable resources.

Use isolated containers, networks, volumes or tmpfs.

Do not bind disposable test services to the production application's ports.

If isolation cannot be guaranteed, do not execute the test.

---

# PART B — RELEASE READINESS AUDIT

## 9. Create a Release Verification Matrix

Inspect the current implementation and create a concise matrix:

| Area | Existing Implementation | Evidence | Verification Status | Action |
|------|-------------------------|----------|---------------------|--------|
| Docker build | ... | ... | ... | ... |
| Compose | ... | ... | ... | ... |
| REST proxy | ... | ... | ... | ... |
| WebSocket | ... | ... | ... | ... |
| Health checks | ... | ... | ... | ... |
| GitHub Actions | ... | ... | ... | ... |
| Image security | ... | ... | ... | ... |
| Backup/restore | ... | ... | ... | ... |
| Database recovery | ... | ... | ... | ... |
| Logging | ... | ... | ... | ... |

Use these verification states:
- VERIFIED LOCALLY.
- VERIFIED IN CI.
- VERIFIED MANUALLY.
- NOT VERIFIED.
- BLOCKED.

Do not confuse implementation with successful execution.

## 10. Establish a Baseline

Before changes:
- Inspect Git status.
- Identify existing uncommitted changes.
- Review existing test scripts.
- Review existing Docker image tags.
- Review existing CI workflow.
- Review current documentation.

Do not discard unrelated changes.

Do not overwrite user modifications.

Record the baseline in the audit report.

---

# PART C — GITHUB ACTIONS VERIFICATION

## 11. CI Workflow Audit

Inspect the workflow introduced in PROMPT_041.

Verify:
- Valid YAML.
- Correct workflow triggers.
- Correct repository paths.
- Correct Java version.
- Correct Node version.
- Maven Wrapper usage.
- Lockfile-based npm installation.
- PostgreSQL/PostGIS availability where required.
- Backend test execution.
- Web test execution.
- Web production build.
- Docker image build.
- Compose configuration validation.
- Minimal GitHub Actions permissions.

Do not replace the existing workflow unless necessary.

## 12. Actual GitHub Runner Verification

A workflow file existing in the repository does not prove CI works.

Determine whether actual GitHub Actions run results are available.

If repository access and permission are available:
- Inspect the latest relevant workflow runs.
- Identify failing jobs.
- Read relevant failure logs.
- Fix verified workflow issues.
- Re-run or request re-run when supported.

If GitHub Actions access is unavailable:
- Do not invent successful runner results.
- Do not claim CI is verified.
- Provide exact steps for the user to push a branch and open a pull request.
- Explain where to find the workflow results in GitHub.

Do not automatically push commits or open pull requests without user authorization.

Do not require paid CI services.

## 13. Backend CI Reliability

Verify:
- Maven Wrapper executes correctly on Linux runners.
- Required wrapper files exist.
- Java 21 is configured.
- Tests run against appropriate dependencies.
- Database-dependent tests use a safe test database.
- PostgreSQL/PostGIS compatibility is maintained.
- Test failures cause the job to fail.
- Tests are not silently skipped.

Do not disable tests merely to obtain a green workflow.

## 14. Web CI Reliability

Verify:
- Correct Node version.
- Correct package manager.
- npm ci uses the lockfile.
- Web tests run.
- TypeScript checks run where configured.
- Production build runs.
- Build failures fail the job.

Do not include Mobile.

## 15. CI Build Optimization

Review:
- Maven dependency caching.
- npm dependency caching.
- Duplicate installation steps.
- Unnecessary repeated builds.
- Build context size.

Only optimize where meaningful.

Avoid premature complexity.

---

# PART D — CONTAINER SECURITY

## 16. Container Security Audit

Inspect:
- Backend base images.
- Web base images.
- Runtime users.
- Dockerfile COPY instructions.
- .dockerignore.
- Exposed ports.
- Container privileges.
- Linux capabilities.
- Filesystem permissions.
- Persistent volumes.
- Secret handling.

Preserve existing non-root Backend behavior.

Do not introduce privileges merely to fix filesystem errors.

## 17. Image Vulnerability Scanning

Add or document a practical vulnerability scanning workflow.

Prefer a widely used scanner such as Trivy if appropriate for the repository.

Requirements:
- Scan final runtime images, not only build stages.
- Report Critical and High findings.
- Identify affected packages.
- Identify available fixes.
- Distinguish fixable from currently unfixable findings.
- Avoid publishing secrets.
- Record scanner version and database update status.
- Avoid treating every scanner finding as proof of exploitability.

Do not blindly upgrade major application dependencies.

If scanning tools cannot run in the current environment, document the exact commands and mark results NOT VERIFIED.

## 18. Vulnerability Handling

For every significant finding:
- Record affected image.
- Package name.
- Installed version.
- Fixed version, if available.
- Severity.
- Relevant exposure.
- Proposed remediation.

Prioritize verified Critical and High findings.

Prefer safe patch-level image updates when appropriate.

Do not downgrade application security.

If a vulnerability has no safe fix, document the residual risk.

## 19. Software Bill of Materials

Generate an SBOM for the final Backend and Web images where tooling is available.

Prefer a standard format such as CycloneDX or SPDX.

Requirements:
- Include relevant package metadata.
- Associate SBOM with image name and immutable image identifier.
- Do not include secrets.
- Store artifacts in a documented local or CI output location.
- Avoid committing large generated SBOM files unless the repository intentionally tracks them.

If SBOM generation is unavailable, provide reproducible instructions.

## 20. Image Build Reproducibility

Review:
- Base image pinning.
- Node version.
- Java version.
- npm ci.
- Maven Wrapper.
- Build contexts.
- Image tags.

Do not use mutable latest-only tagging for release artifacts.

Do not force immutable digest pinning if it would break existing beginner-friendly maintenance workflows without a justified benefit.

Document the tradeoffs.

---

# PART E — RELIABILITY & RECOVERY

## 21. Existing Realtime Verification

The user already confirmed:

- Chat works through Docker.
- Backend restart does not require browser refresh to resume messaging.

Do not repeat this implementation.

Focus on scenarios not yet verified.

## 22. Database Restart Recovery

Inspect how Backend handles temporary PostgreSQL unavailability.

Review:
- Database connection pool configuration.
- Transaction failures.
- Health state.
- Reconnection behavior.
- Web error feedback.
- Recovery after database returns.

Test only in an isolated disposable stack.

Do not restart or disrupt the user's active database automatically.

Expected behavior:
- Temporary database failure does not corrupt application data.
- The system fails requests safely while the database is unavailable.
- Service recovers when database connectivity returns, or documents a justified restart requirement.
- No sensitive error details leak to the browser.

Do not promise uninterrupted messaging while the database is offline.

## 23. Backend Restart and Web Recovery

Review existing reconnection implementation.

Verify:
- WebSocket reconnect does not create duplicate subscriptions.
- Notifications do not duplicate after reconnect.
- Chat state remains consistent.
- User session remains valid when appropriate.
- Unread counts remain consistent.

Use existing tests where sufficient.

Add tests only for gaps or reproducible defects.

## 24. Container Health Behavior

Inspect:
- Database health check.
- Backend health check.
- Web health check.
- Startup dependency conditions.
- Restart policies.
- Graceful shutdown.

Remember:
- A health check reporting unhealthy does not automatically guarantee Docker Compose will restart the container.
- HTTP liveness does not imply database readiness.

Do not claim otherwise.

Avoid adding complex orchestration.

## 25. Failure Scenario Matrix

Document expected and observed behavior for:

1. Backend restart.
2. Database temporarily unavailable.
3. Web container restart.
4. WebSocket disconnect.
5. Invalid JWT.
6. Backend unavailable during an API request.
7. Container startup with missing required secrets.
8. Database recovery after restart.

Mark each scenario:
- PASS.
- FAIL.
- NOT TESTED.
- BLOCKED.

Do not mark a scenario PASS without execution evidence.

---

# PART F — BACKUP & RESTORE VERIFICATION

## 26. Audit Existing Backup Procedure

Review docs/deployment.md.

Verify:
- pg_dump uses appropriate database settings.
- Backup format is correct.
- Backup files are stored outside disposable containers.
- Binary backups are safe in Windows PowerShell.
- Credentials are not exposed.
- Backup file permissions are documented.
- Restore targets are clearly isolated.

Do not recreate existing scripts unnecessarily.

## 27. Disposable Recovery Drill

PROMPT_041 already verified backup/restore using disposable data.

Do not repeat identical testing without additional value.

Extend verification only where useful:
- Representative schema objects.
- Flyway history.
- PostGIS extension availability.
- Spatial columns/indexes.
- Representative chat-related tables.
- Referential integrity.

Use generated synthetic test data.

Do not copy private user conversations into test artifacts.

## 28. Restore Validation

A successful pg_restore exit code alone is insufficient.

Where feasible, verify:
- Required tables exist.
- Flyway history is present.
- PostGIS extension is available.
- Representative data matches expected values.
- Application can connect to restored database.
- No unexpected schema incompatibility.

Do not restore into the user's existing database.

## 29. Backup Limitations

Document:
- Logical backup consistency.
- Backup storage risks.
- Backup retention.
- Backup encryption options.
- Recovery time considerations.
- Recovery point considerations.
- PostGIS version compatibility.

Do not claim point-in-time recovery unless WAL archiving/PITR is implemented.

Do not add a complex backup scheduling service unless required.

## 30. Chat Image Storage

The application also has persistent chat image storage.

Verify:
- Database backup alone does not necessarily include uploaded images.
- Image volume preservation is documented.
- Database and file storage may require coordinated recovery.
- Restored messages should not reference missing files unexpectedly.

If an image backup procedure is missing, document a safe backup/restore approach.

Do not automatically delete or rewrite image files.

---

# PART G — RELEASE CHECKLIST

## 31. Create a Release Checklist

Create or improve a document such as:

docs/release-checklist.md

Follow existing documentation conventions.

Include:
- Git status clean or reviewed.
- Tests passing.
- CI status.
- Docker images built.
- Compose configuration validated.
- Required secrets present.
- Database backup available.
- Chat image backup considered.
- Health checks passing.
- REST proxy working.
- WebSocket working.
- Authentication working.
- Chat working.
- Nearby privacy intact.
- Notifications working.
- Rollback procedure understood.
- Known issues recorded.

Keep it concise and actionable.

## 32. Local Release Verification

Document a reproducible sequence using Windows PowerShell.

Use existing commands:

docker compose --env-file .env config --quiet
docker compose --env-file .env build
docker compose --env-file .env up -d
docker compose --env-file .env ps

Do not repeat these commands unnecessarily inside multiple scripts.

Do not print expanded secret values.

## 33. Smoke Test Checklist

Include manual checks for:
- Login/logout.
- DIRECT chat.
- GROUP chat.
- Realtime messages.
- Notifications.
- Nearby.
- Image attachments.
- SPA refresh.
- Backend restart/reconnect.
- Database persistence.

Distinguish previous manual verification from new verification.

## 34. Rollback Readiness

Review existing APP_VERSION handling.

Verify:
- Images can be identified by version.
- Previous images can be retained.
- Application rollback instructions are accurate.
- Database migration limitations are documented.
- Uploaded images are preserved.

Do not execute rollback against the user's active stack unless explicitly requested.

---

# PART H — TESTING

## 35. Backend Tests

Run relevant tests using Maven Wrapper.

Verify:
- Compilation.
- Unit tests.
- Integration tests where available.
- Security regression tests.
- Database-related tests.

Do not assume the previous 120-test result remains current.

Report fresh results.

## 36. Web Tests

Run:
- Existing Web tests.
- TypeScript validation.
- Production build.

Do not run Mobile tests.

## 37. Docker Validation

Verify:
- Backend image builds.
- Web image builds.
- Compose configuration parses.
- Health checks work in disposable environments.
- Required production configuration is enforced.

Avoid touching persistent volumes.

## 38. CI Validation

If GitHub runner execution is available:
- Record workflow run identifier or link.
- Record job results.
- Identify any failed jobs.
- Fix verified failures.

If unavailable:
- Mark GitHub runner verification BLOCKED.
- Provide instructions for the user to complete it.

Do not fabricate CI success.

## 39. Security Scan Validation

If scanner is available:
- Scan both final images.
- Record findings.
- Generate SBOM.
- Document remaining risks.

If unavailable:
- Record NOT VERIFIED.
- Provide commands for later execution.

## 40. Recovery Tests

Use disposable resources for:
- Database restart.
- Restore verification.
- Backend recovery.
- Health behavior.

Do not run destructive recovery tests on existing data.

---

# PART I — IMPLEMENTATION PHASES

## 41. Phase 1 — Audit

- Inspect repository.
- Review existing infrastructure.
- Review PROMPT_041 results.
- Identify verification gaps.
- Produce a short action plan.

## 42. Phase 2 — CI Verification

- Inspect GitHub Actions.
- Fix verified CI issues.
- Run local equivalents where useful.
- Obtain real runner results if accessible.

## 43. Phase 3 — Container Security

- Add or document image scanning.
- Generate SBOM.
- Triage vulnerabilities.
- Apply safe fixes where justified.

## 44. Phase 4 — Recovery Verification

- Use disposable Docker resources.
- Test database unavailability and recovery.
- Verify health behavior.
- Review WebSocket reconnect consistency.
- Verify backup/restore coverage.

## 45. Phase 5 — Release Documentation

- Create release checklist.
- Improve backup/recovery documentation where needed.
- Document known limitations.
- Provide PowerShell commands.

## 46. Phase 6 — Final Validation

- Run Backend tests.
- Run Web tests/build.
- Validate Docker images.
- Validate Compose.
- Review security findings.
- Report verification results.

---

# PART J — ACCEPTANCE CRITERIA

## 47. Completion Checklist

PROMPT_042 implementation is complete when:

- [ ] Existing deployment infrastructure was audited.
- [ ] Already verified functionality was reused.
- [ ] GitHub Actions workflow was reviewed.
- [ ] Actual GitHub runner status is reported accurately.
- [ ] Backend CI configuration is valid.
- [ ] Web CI configuration is valid.
- [ ] Docker build configuration is valid.
- [ ] Final Backend image was security-scanned or scanning limitation documented.
- [ ] Final Web image was security-scanned or scanning limitation documented.
- [ ] Significant vulnerabilities were triaged.
- [ ] SBOM was generated or reproducible instructions provided.
- [ ] Database failure/recovery behavior was reviewed.
- [ ] Disposable recovery tests were performed where safe and available.
- [ ] Backup/restore documentation was verified.
- [ ] Chat image volume backup was considered.
- [ ] Release checklist was created or improved.
- [ ] Rollback documentation remains accurate.
- [ ] Backend tests pass.
- [ ] Web tests and build pass.
- [ ] Docker images build successfully.
- [ ] Compose configuration is valid.
- [ ] Existing data remains intact.
- [ ] Mobile remains untouched.
- [ ] No unnecessary product features were added.

## 48. Completion Status Rules

Distinguish between:
- IMPLEMENTED.
- VERIFIED LOCALLY.
- VERIFIED MANUALLY.
- VERIFIED IN CI.
- NOT VERIFIED.
- BLOCKED.
- FAILED.

Do not confuse an implementation being complete with all external verification being complete.

An unavailable GitHub runner does not justify inventing a successful CI run.

A blocked verification must have:
- Reason.
- Exact follow-up action.
- Expected evidence.

Do not report a clean security scan unless an actual scan completed.

Do not report a successful recovery drill unless it was executed.

## 49. Final Report

Provide a Vietnamese report containing:

1. Initial audit.
2. Existing verified functionality.
3. CI review and execution status.
4. Docker security scan results.
5. SBOM results.
6. Vulnerabilities and remediation.
7. Database recovery findings.
8. WebSocket/reconnect findings.
9. Backup/restore verification.
10. Chat image backup considerations.
11. Release checklist.
12. Files created.
13. Files modified.
14. Backend test results.
15. Web test/build results.
16. Docker build results.
17. Compose validation results.
18. Manual tests performed.
19. Unverified scenarios.
20. Remaining risks.
21. Recommended next milestone.

End with exactly one of:

PROMPT_042 COMPLETE

or

PROMPT_042 NOT COMPLETE

Only report COMPLETE if the implementation acceptance criteria are met, no unresolved Critical or High security finding remains within scope, and every required verification is either completed or explicitly documented as an external blocker with reproducible follow-up steps.

Do not claim full release readiness if important runtime or CI checks remain unverified.