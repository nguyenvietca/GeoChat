# PROMPT_041 — GeoChat Deployment & Monitoring Foundation

## 1. Project Context

GeoChat is a location-based social messaging application.

Confirmed technology stack:
- Backend: Java 21, Spring Boot 4.1.0, Maven Wrapper.
- Database: PostgreSQL 16 + PostGIS.
- Database migrations: Flyway.
- Web: React, TypeScript, Vite.
- Authentication: JWT.
- Realtime: WebSocket/STOMP.
- Architecture: Modular monolith.
- Repository: Monorepo with backend, web, mobile, packages, database and docs areas. Verify actual paths.
- Development environment: Windows with Docker Desktop.

Confirmed completed milestones:
- PROMPT_036 — Nearby Discovery & Map UX.
- PROMPT_037 — Friend Discovery & Connection UX.
- PROMPT_038 — Chat Performance & Pagination Optimization.
- PROMPT_039 — Notifications & Realtime UX.
- PROMPT_040 — Security & Production Readiness.

PROMPT_040 results reported:
- Backend: 120 passing tests, 3 skipped.
- Targeted security tests: 57/57 passed.
- Web: 171 passing tests.
- Web production build: passed.
- npm audit: 0 vulnerabilities.
- No unresolved Critical or High findings.
- Existing API and database schema preserved.

Treat these as the previous milestone's reported results. Run fresh validation where needed.

## 2. Primary Objective

Create a repeatable, understandable and secure deployment foundation for GeoChat.

Deliver:

1. Containerized Backend.
2. Containerized Web.
3. Existing PostgreSQL/PostGIS integration.
4. Docker Compose application stack.
5. Production-like configuration.
6. Container health checks.
7. Basic logging and monitoring.
8. GitHub Actions continuous integration.
9. Database backup and restore instructions.
10. Safe update and rollback procedures.
11. Beginner-friendly documentation.

This milestone prepares GeoChat for deployment.

It does not require deploying to a public server.

---

# PART A — MANDATORY RULES

## 3. Audit First — Avoid Duplicate Work

Before coding, inspect:
- Existing docker-compose.yml.
- Existing Dockerfiles.
- Existing .dockerignore files.
- Existing .env.example.
- Existing production configuration.
- Existing health endpoints.
- Existing GitHub Actions workflows.
- Existing README and docs.
- Backend Maven Wrapper.
- Web package.json.
- Existing Flyway configuration.

Classify each requirement:

- ALREADY IMPLEMENTED.
- NEEDS IMPROVEMENT.
- MISSING.
- NOT APPLICABLE.

Reuse correct existing implementations.

Do not replace working infrastructure unnecessarily.

Do not remove useful explanatory comments.

## 4. Mobile — Strictly Excluded

- Do not modify Mobile source.
- Do not implement Mobile features.
- Do not build Mobile.
- Do not typecheck Mobile.
- Do not test Mobile.

Preserve existing API compatibility.

## 5. Scope Boundaries

Allowed:
- Dockerfiles.
- Docker Compose configuration.
- Environment templates.
- Deployment scripts.
- GitHub Actions workflows.
- Deployment documentation.
- Minimal Backend configuration changes.
- Minimal Web runtime/deployment configuration changes.
- Tests required for deployment correctness.

Avoid:
- New product features.
- Authentication redesign.
- Database schema redesign.
- Redis.
- Kubernetes.
- Kafka.
- Cloud-provider-specific deployment.
- Terraform.
- Public domain setup.
- Automatic production deployment.
- New monitoring infrastructure requiring multiple services.

Do not modify the application architecture without a verified deployment requirement.

---

# PART B — DEPLOYMENT ARCHITECTURE

## 6. Target Architecture

Use Docker Compose to run:

1. Web container.
2. Backend container.
3. PostgreSQL/PostGIS container.

Suggested request flow:

Browser
   |
   v
Web Server / Reverse Proxy
   |
   +-- /             -> React SPA
   |
   +-- /api/...      -> Spring Boot Backend
   |
   +-- WebSocket     -> Spring Boot STOMP endpoint
                            |
                            v
                     PostgreSQL/PostGIS

The exact paths must match the repository's existing REST and WebSocket configuration.

Prefer a same-origin browser setup.

Avoid exposing the Backend directly to the public Internet when a reverse proxy is sufficient.

Do not invent API paths or WebSocket handshake paths.

## 7. Compose Design

Prefer extending the existing Compose configuration.

If useful, separate:
- Existing local development Compose configuration.
- Production-like Compose override.

Do not create multiple overlapping Compose files without a clear purpose.

Requirements:
- Clear service names.
- Explicit internal networking.
- Persistent PostgreSQL volume.
- Database health check.
- Backend health check.
- Web health check.
- Correct startup dependencies.
- Appropriate restart policies.
- Configurable published ports.

Do not use container startup order as a substitute for readiness.

Backend must tolerate temporary database unavailability appropriately.

## 8. Preserve Existing Database Configuration

The existing project has used:

postgis/postgis:16-3.4

Preserve the current image/version unless a verified compatibility issue requires changing it.

Preserve existing environment variable conventions where possible:
- DB_NAME
- DB_USERNAME
- DB_PASSWORD
- DB_PORT

Inspect actual configuration before using these names.

Do not recreate the database volume.

Do not reset database data.

Do not use docker compose down -v as a normal deployment command.

---

# PART C — BACKEND DOCKER IMAGE

## 9. Backend Dockerfile

Create or improve a production-oriented Dockerfile.

Requirements:
- Java 21 compatible.
- Multi-stage build where appropriate.
- Use Maven Wrapper.
- Use existing pom.xml.
- Respect actual project structure.
- Build executable Spring Boot JAR.
- Use a suitable lightweight runtime image.
- Run as a non-root user where practical.
- Keep build tools out of runtime image.
- Avoid copying secrets into the image.

Use pinned image versions and preferably immutable digests when practical.

Do not blindly use latest tags.

## 10. Backend Build

Ensure the container build:
- Works from the repository's documented build context.
- Includes required Maven Wrapper files.
- Handles executable permissions correctly.
- Uses an appropriate .dockerignore.
- Does not include node_modules or unrelated project artifacts.
- Does not require locally installed Maven.

Avoid disabling tests without explaining where tests run.

If tests are handled by CI, document the separation between image build and validation.

## 11. Backend Runtime

Requirements:
- Read configuration from environment variables.
- Respect PROMPT_040 mandatory production secrets.
- No hardcoded JWT secret.
- No hardcoded database password.
- No permissive production CORS fallback.
- Proper JVM shutdown behavior.
- Clear startup logging without sensitive values.
- Graceful termination where supported.

Do not weaken security to make containers start.

---

# PART D — WEB DOCKER IMAGE

## 12. Web Dockerfile

Create or improve a multi-stage Dockerfile.

Suggested:
- Node build stage.
- Lightweight Nginx runtime stage.

Verify the actual Web package manager and build scripts.

Requirements:
- Use lockfile-based deterministic installation.
- Build the React/Vite application.
- Serve static assets efficiently.
- Do not include source dependencies in runtime unnecessarily.
- Avoid exposing development server ports.
- Use an appropriate .dockerignore.

Do not use Vite development server for production.

## 13. SPA Routing

Configure the Web server so that:
- Existing frontend routes work after refresh.
- Static assets return correct content.
- Missing assets do not silently return index.html as successful JavaScript.
- Cache policy distinguishes hashed assets from HTML.
- Basic security headers are applied without breaking the app.

Reuse existing routing conventions.

## 14. Reverse Proxy

Configure reverse proxy routes using actual application paths.

Requirements:
- Forward REST requests to Backend.
- Support WebSocket upgrade.
- Preserve required forwarding headers.
- Avoid exposing internal service names to the browser.
- Avoid unnecessary CORS complexity.
- Respect existing authentication.

Test WebSocket handshake and reconnect.

Do not assume a generic /ws path exists.

## 15. Frontend Environment Variables

Important:
Vite environment variables are typically embedded at build time.

Audit existing frontend configuration.

Prefer relative same-origin API/WebSocket paths where compatible.

Do not expose secrets through VITE_* variables.

Do not add a complex runtime configuration system unless necessary.

Document which values are:
- Build-time.
- Runtime.
- Server-only secrets.

---

# PART E — CONFIGURATION & SECRETS

## 16. Environment Templates

Create or improve .env.example.

Document required variables without real credentials.

Include only variables actually used.

Potential areas:
- Database credentials.
- JWT secret.
- Allowed CORS origins.
- Published Web port.
- Backend profile.
- Logging level.
- Database connection settings.

Preserve existing variable names when possible.

Do not overwrite the developer's real .env.

Do not commit secrets.

## 17. Production Profile

Inspect existing Spring production profile.

Verify:
- Mandatory secret validation.
- Safe CORS defaults.
- No sensitive debug logging.
- Correct database connectivity.
- Flyway startup behavior.
- Appropriate error responses.
- Health endpoint access.

Do not duplicate PROMPT_040 protections.

## 18. Compose Secret Handling

Avoid placing secrets directly in docker-compose.yml.

Use appropriate local environment or secret-file mechanisms.

Document limitations:
- Environment variables may be visible to users with Docker host access.
- Local .env files are not a full production secrets manager.

Do not claim Docker Compose provides enterprise secret management automatically.

---

# PART F — HEALTH CHECKS & MONITORING

## 19. Database Health Check

Use a suitable PostgreSQL readiness command.

Requirements:
- Check the configured database/user.
- Avoid exposing passwords in command output.
- Set reasonable interval, timeout and retries.
- Ensure dependent services do not start against a permanently unready database.

## 20. Backend Health Check

Reuse existing HealthController or Actuator health endpoint.

Do not add duplicate health endpoints.

Requirements:
- Lightweight response.
- No sensitive information.
- Suitable for container health checks.
- Correct behavior during startup.
- No authentication bypass beyond the intended health endpoint.

Document what the health check actually verifies.

Do not call it a full readiness check unless it verifies required dependencies.

## 21. Web Health Check

Provide a lightweight Web server health check.

Requirements:
- Check local HTTP availability.
- Avoid relying on public DNS.
- Avoid exposing sensitive information.

Ensure the health-check command is available inside the runtime image.

## 22. Logging

Use Docker-compatible stdout/stderr logging.

Requirements:
- Clear service identification.
- Useful startup and failure diagnostics.
- No JWT tokens.
- No passwords.
- No private message bodies.
- No precise user coordinates.

Configure bounded log rotation where supported.

Avoid introducing Elasticsearch, Loki, Prometheus or Grafana in this milestone.

## 23. Basic Monitoring Commands

Document how to:
- List running services.
- Inspect container health.
- View Backend logs.
- View Web logs.
- View database logs.
- Inspect resource usage.
- Restart one service.
- Diagnose startup failures.

Provide commands that work with Docker Compose v2.

---

# PART G — GITHUB ACTIONS CI

## 24. CI Objective

Create or improve a GitHub Actions workflow.

Trigger on:
- Pull requests.
- Pushes to appropriate development branches.

Inspect the repository's actual branch conventions.

Do not assume main/develop exist without checking.

## 25. Backend CI

Requirements:
- Set up Java 21.
- Use Maven Wrapper.
- Cache Maven dependencies appropriately.
- Compile Backend.
- Run relevant automated tests.
- Report failures clearly.

If tests require PostgreSQL/PostGIS:
- Use an appropriate CI service container or test environment.
- Preserve the expected PostGIS version.
- Configure test-only credentials.
- Wait for database readiness.

Do not silently skip database-dependent tests.

Document intentional skips.

## 26. Web CI

Requirements:
- Use compatible Node version.
- Use the existing package manager.
- Install dependencies from lockfile.
- Run Web tests.
- Run typecheck/lint if configured.
- Run production build.

Do not install or test Mobile.

## 27. Docker Build Validation

Add a CI job or step to validate:
- Dockerfile syntax/build.
- Compose configuration.
- Backend image build.
- Web image build.

Avoid publishing images to a registry in this milestone unless the repository already has a safe publishing workflow.

Do not require production secrets for a compile-only image build.

## 28. CI Security

Requirements:
- No secrets in workflow logs.
- Minimal GitHub Actions permissions.
- No automatic production deployment.
- No unnecessary privileged containers.
- No untrusted pull request execution with production credentials.

Pin GitHub Actions to appropriate maintained versions, preferably immutable references where practical.

Preserve existing working CI jobs.

---

# PART H — DATABASE BACKUP & RESTORE

## 29. Backup Documentation

Document a PostgreSQL logical backup procedure suitable for the current Compose stack.

Requirements:
- Use pg_dump with the correct database.
- Preserve PostGIS-related database objects.
- Avoid embedding passwords directly in commands.
- Store backups outside disposable containers.
- Use a timestamped filename.
- Document backup file permissions.

Provide Windows PowerShell-compatible examples.

Be careful with shell redirection and binary/custom-format backups.

Prefer a procedure that avoids PowerShell binary stream corruption.

## 30. Restore Documentation

Document:
- How to restore to a disposable test database.
- Required PostgreSQL/PostGIS compatibility.
- How to validate the restored data.
- How to handle application downtime.
- How Flyway interacts with restored schemas.

Do not automatically restore into the active database.

Do not overwrite production data during tests.

## 31. Backup Verification

Where a safe test environment is available:
- Create a test backup.
- Restore into a disposable database.
- Verify tables and representative data.
- Record actual results.

If verification cannot be performed, mark it NOT VERIFIED.

Do not claim backups are valid solely because pg_dump exited successfully.

---

# PART I — DEPLOYMENT & ROLLBACK

## 32. First Deployment Procedure

Document:

1. Prerequisites.
2. Environment setup.
3. Secret configuration.
4. Docker Compose configuration validation.
5. Image build.
6. Container startup.
7. Health verification.
8. Web access.
9. Backend API verification.
10. WebSocket verification.

Provide commands for Windows PowerShell.

Do not assume globally installed Maven.

## 33. Update Procedure

Document:
- Pulling updated source.
- Running tests.
- Building new images.
- Backing up database before risky changes.
- Restarting changed services.
- Checking health.
- Inspecting logs.

Avoid unnecessary database downtime.

Do not remove persistent volumes.

## 34. Rollback Procedure

Document:
- How to identify the previous working image.
- How to restore a previous application image.
- How to verify rollback success.
- How to handle failed startup.

Important:
Rolling back an application image does not automatically roll back database migrations.

Do not promise safe database rollback without a verified migration/restore strategy.

Prefer explicit versioned image tags over mutable latest-only deployment.

## 35. Failure Recovery

Provide troubleshooting guidance for:
- Missing JWT_SECRET.
- Missing DB credentials.
- Missing CORS origins.
- PostgreSQL not ready.
- Flyway migration failure.
- Backend container unhealthy.
- Web container unhealthy.
- WebSocket proxy failure.
- Port conflicts.
- Incorrect API base URL.
- Stale frontend build.
- Docker disk space problems.

Explain likely causes and diagnostic commands.

---

# PART J — DOCUMENTATION

## 36. Deployment Guide

Create a beginner-friendly document, for example:

docs/deployment.md

Use actual repository conventions.

Include:
- Architecture overview.
- Prerequisites.
- File structure.
- Environment variables.
- Build instructions.
- Startup instructions.
- Health checks.
- Logging commands.
- Backup/restore.
- Update procedure.
- Rollback procedure.
- Troubleshooting.
- Security notes.

Do not duplicate existing documentation unnecessarily.

## 37. Explain Docker Concepts

Briefly explain:
- Image.
- Container.
- Dockerfile.
- Docker Compose.
- Volume.
- Network.
- Health check.
- Build context.
- Environment variables.

Include comments in configuration files where useful.

Keep explanations practical.

## 38. Command Compatibility

Primary examples should work on:
- Windows PowerShell.
- Docker Desktop.
- Docker Compose v2.

Use:
docker compose

rather than relying on the older docker-compose executable.

Use Maven Wrapper for Backend.

Do not require local Maven installation.

---

# PART K — VALIDATION

## 39. Backend Validation

Run actual repository commands:
- Backend compile.
- Relevant Backend tests.
- Backend Docker image build.

Use Maven Wrapper.

Report exact results.

## 40. Web Validation

Run:
- Web tests.
- Web production build.
- Web Docker image build.

Run typecheck/lint if configured.

Do not run Mobile tests.

## 41. Compose Validation

Verify:
- Docker Compose configuration parses.
- All required services are defined.
- Database persistence is configured.
- Health checks are valid.
- Internal networking works.
- Required secrets are enforced.
- Backend can connect to PostgreSQL.
- Web can reach Backend through the proxy.

Do not print expanded secret values in reports.

## 42. End-to-End Smoke Tests

When Docker is available, test:

Scenario A — Startup:
- Start the stack.
- Verify container health.
- Open the Web UI.

Scenario B — Authentication:
- Log in.
- Refresh the page.
- Log out.

Scenario C — Chat:
- Send a DIRECT message.
- Receive it from another account.
- Verify WebSocket connectivity.

Scenario D — GROUP:
- Open a group conversation.
- Send a message.
- Verify delivery.

Scenario E — Nearby:
- Open Nearby.
- Verify authorized location behavior.
- Verify privacy rules.

Scenario F — Notifications:
- Trigger a notification.
- Verify realtime delivery.

Scenario G — Restart:
- Restart Backend.
- Verify database persistence.
- Verify Web reconnect behavior.

Scenario H — Backup:
- Create a safe test backup.
- Restore to a disposable database if possible.

Do not perform destructive tests against the user's existing database.

## 43. Existing Data Protection

This is critical.

Never:
- Delete existing PostgreSQL volumes.
- Reinitialize the user's database.
- Run docker compose down -v against existing data.
- Drop the database as part of normal deployment.
- Execute restore commands against an existing database without explicit approval.
- Commit secrets.
- Disable production security requirements.

If a step could destroy data, stop and explain the risk before proceeding.

---

# PART L — IMPLEMENTATION PHASES

## 44. Phase 1 — Audit

- Inspect existing infrastructure.
- Identify reusable files.
- Identify missing deployment capabilities.
- Review compatibility risks.
- Present a concise plan.

## 45. Phase 2 — Docker Images

- Implement or improve Backend Dockerfile.
- Implement or improve Web Dockerfile.
- Add appropriate .dockerignore files.
- Validate image builds.

## 46. Phase 3 — Compose Integration

- Extend existing Compose configuration.
- Preserve PostgreSQL volume.
- Configure internal networking.
- Configure health checks.
- Configure production-like environment.
- Validate configuration.

## 47. Phase 4 — Web Proxy

- Configure static serving.
- Configure SPA routing.
- Configure REST proxy.
- Configure WebSocket proxy.
- Verify authentication and realtime behavior.

## 48. Phase 5 — CI

- Implement or improve GitHub Actions.
- Validate Backend.
- Validate Web.
- Validate Docker builds.
- Avoid Mobile jobs.

## 49. Phase 6 — Operations

- Document logging.
- Document monitoring.
- Document backup/restore.
- Document update/rollback.
- Add troubleshooting guidance.

## 50. Phase 7 — Verification

- Run Backend tests.
- Run Web tests/build.
- Build Docker images.
- Validate Compose.
- Perform safe smoke tests where possible.
- Document results and limitations.

---

# PART M — ACCEPTANCE CRITERIA

## 51. Completion Checklist

PROMPT_041 is complete when:

- [ ] Existing Docker configuration was audited.
- [ ] Existing PostgreSQL/PostGIS configuration is preserved.
- [ ] Backend production image builds successfully.
- [ ] Web production image builds successfully.
- [ ] Docker Compose configuration is valid.
- [ ] Database volume is persistent.
- [ ] Required production secrets are enforced.
- [ ] Backend health check works.
- [ ] Web health check works.
- [ ] Database health check works.
- [ ] Web reverse proxy supports REST.
- [ ] Web reverse proxy supports WebSocket.
- [ ] SPA routes work after refresh.
- [ ] Backend can connect to PostgreSQL.
- [ ] Flyway behavior remains correct.
- [ ] Existing JWT authentication remains functional.
- [ ] Existing chat remains functional.
- [ ] Existing Nearby remains functional.
- [ ] Existing notifications remain functional.
- [ ] GitHub Actions validates Backend.
- [ ] GitHub Actions validates Web.
- [ ] Docker image builds are validated.
- [ ] Deployment documentation exists.
- [ ] Backup procedure is documented.
- [ ] Restore procedure is documented.
- [ ] Update procedure is documented.
- [ ] Rollback procedure is documented.
- [ ] Basic monitoring/logging commands are documented.
- [ ] Backend tests pass.
- [ ] Web tests and build pass.
- [ ] Existing database data remains intact.
- [ ] Mobile source remains unchanged.

For environment-dependent criteria, distinguish:
- Implemented.
- Verified locally.
- Verified in CI.
- Not verified.

Do not mark unperformed smoke tests as passed.

## 52. Final Report

Provide a Vietnamese report containing:

1. Existing deployment architecture audit.
2. Already implemented infrastructure.
3. New or modified Dockerfiles.
4. Docker Compose changes.
5. Web reverse proxy configuration.
6. Environment and secret handling.
7. Health checks.
8. Logging and monitoring.
9. GitHub Actions changes.
10. Backup/restore procedures.
11. Update/rollback procedures.
12. Files created.
13. Files modified.
14. Backend test results.
15. Web test/build results.
16. Docker build results.
17. Compose validation results.
18. Smoke tests actually performed.
19. Existing data preservation.
20. Mobile compatibility.
21. Known limitations.
22. Recommended next milestone.

Do not invent test results.

End with exactly one of:

PROMPT_041 COMPLETE

or

PROMPT_041 NOT COMPLETE

Only report COMPLETE when required implementation and validation criteria are satisfied.

If Docker or CI execution is unavailable, clearly state which criteria remain unverified rather than claiming success.