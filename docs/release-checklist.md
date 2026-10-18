# Release checklist

Evidence for PROMPT_042: [release-verification-042.md](release-verification-042.md).
Deployment, backup and rollback: [deployment.md](deployment.md).

- [ ] Git diff/status reviewed; no secrets, private data or Mobile changes.
- [ ] Backend tests pass, including enabled PostgreSQL/PostGIS tests on isolated DB.
- [ ] Web tests and `npm run build` (includes TypeScript) pass.
- [ ] GitHub CI jobs pass for the exact release commit; save run link.
- [ ] Final images built with unique `APP_VERSION`; retain previous tags and image IDs.
- [ ] Scan both runtime images; triage HIGH/CRITICAL, fixed versions and exposure; save SBOMs.
- [ ] Required DB/JWT/CORS secrets set; `config --quiet` passes without printing values.
- [ ] Recent DB backup hashed, protected and recoverable; image backup coordinated.
- [ ] Disposable recovery drill passes; record duration and restore validation.
- [ ] All container health checks pass; REST proxy and SPA deep-link refresh work.
- [ ] Login/logout and invalid JWT behave correctly.
- [ ] DIRECT/GROUP chat, realtime messages, unread counts, notifications work.
- [ ] Nearby opt-in/privacy and image upload/download work.
- [ ] Backend restart/reconnect resumes with no duplicate events/subscriptions.
- [ ] DB persistence verified; rollback image retained; migration compatibility reviewed.
- [ ] Known issues and unverified scenarios recorded before release approval.

## PowerShell release sequence

From repository root, after reviewing changes and making backups. These commands
update the active stack: run intentionally when ready to deploy, not as a disposable test.
Do not run against the active stack just to repeat earlier verification.

```powershell
docker compose --env-file .env config --quiet
docker compose --env-file .env build
docker compose --env-file .env up -d
docker compose --env-file .env ps
```

Stop at any nonzero exit code. Use a unique `APP_VERSION` in `.env` for releases;
`local` is only a development tag. Patch tags/base image families are mutable:
record image IDs/digests for each release and rebuild intentionally. npm lockfile
and Maven Wrapper pin tool/dependency inputs but do not guarantee byte-identical images.

## Smoke evidence

Prior user verification: containerized two-account messaging/realtime and recovery
after Backend restart without browser refresh. This does not verify GROUP chat,
all disconnect modes, duplicate counts, image attachments or every browser.
Record fresh results separately with date, release image ID, scenario and outcome.
Physical-device checks skipped: no physical device available; Mobile excluded.

## GitHub follow-up (no push performed by the agent)

```powershell
git switch -c release/verify-042
git add .github/workflows/ci.yml docker-compose.yml .gitignore apps/web/Dockerfile apps/web/src/api/client.test.ts backend/Dockerfile backend/pom.xml backend/src/main/java/com/geochat/auth/security/JwtAuthenticationFilter.java backend/src/test/java/com/geochat/auth/JwtDatabaseRecoveryTest.java backend/src/test/java/com/geochat/chat/ChatWebSocketIntegrationTest.java docs/deployment.md docs/release-checklist.md docs/release-verification-042.md docs/image-security.md docs/image-vulnerabilities-042.md scripts/release
git diff --cached
git commit -m "Verify release reliability and recovery"
git push -u origin release/verify-042
```

Open `https://github.com/nguyenvietca/GeoChat/compare` and create a PR to the
development branch. In the PR Checks tab or repository Actions → CI, inspect
`backend`, `web`, `containers`; retain exact commit/run URL and test totals.
The feature-branch push alone does not trigger the current branch-filtered workflow;
opening the PR does. Re-run failed jobs from Actions after fixing their cause.
