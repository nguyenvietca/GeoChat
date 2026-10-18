# PROMPT_042 — Release verification

## Baseline / audit before changes (2026-10-17, Asia/Bangkok)

HEAD: `d86fa5dfd64af0cbe329d23e3e5236f0a90e61ba`. Initial Git status:
only untracked user file `AI_promt/prompt_042.md`; preserve it. Git requires
command-local `-c safe.directory=E:/Java/GeoChat` under the sandbox account.
No global Git configuration changed. Docker access requires sandbox elevation.

| Area | Existing implementation / evidence | Classification | Verification status | Action |
|---|---|---|---|---|
| Docker build | Java 21 multi-stage/non-root; Node 22.12/npm ci; Nginx runtime | ALREADY IMPLEMENTED | VERIFIED MANUALLY | Fresh builds with separate tags |
| Compose | Persistent DB/images, networks, dependency conditions, version tags | VERIFIED WORKING | VERIFIED LOCALLY | `config --quiet` succeeded; never replace active stack |
| REST proxy | `/api/` to backend; same-origin Web | ALREADY IMPLEMENTED | NOT VERIFIED | Disposable smoke test |
| WebSocket | `/ws` Upgrade; prior two-account messaging and backend restart recovery | VERIFIED WORKING | VERIFIED MANUALLY | Reuse prior result, run existing reconnect regressions |
| Health checks | DB pg_isready; backend HTTP liveness; Web wget localhost | NEEDS IMPROVEMENT | VERIFIED LOCALLY | Active Web unhealthy: localhost connection refused, 127.0.0.1 succeeds; fix probe |
| GitHub Actions | PR/push; Java21, npm ci, caches, tests/builds, Compose; contents:read | NEEDS IMPROVEMENT | NOT VERIFIED | Optional PostGIS tests currently skipped; add isolated CI service |
| Image security | Backend non-root; Web root master; no privileged settings; scoped COPY/ignores | ALREADY IMPLEMENTED | NOT VERIFIED | Scan final images and generate SBOM; record residual exposure |
| Backup/restore | Custom pg_dump + docker cp (binary safe); restore currently on live DB service | NEEDS IMPROVEMENT | VERIFIED MANUALLY | Earlier disposable drill accepted; extend real schema/synthetic data in separate container |
| Database recovery | Default Hikari pool, safe generic 500 handler | ALREADY IMPLEMENTED | NOT VERIFIED | Stop/start only disposable DB; check authenticated query and persisted synthetic data |
| Logging | 10 MB x5 Docker log rotation; production INFO | ALREADY IMPLEMENTED | NOT VERIFIED | Inspect config; do not print environment/secrets |
| Deployment docs | Backup/rollback present; dangerous volume deletion example, expanded config command | NEEDS IMPROVEMENT | NOT VERIFIED | Remove unsafe examples; document images, recovery, retention |
| Mobile / public deployment | Excluded | NOT APPLICABLE | NOT VERIFIED | No changes/tests |

GitHub connector returned no PR-triggered workflow runs for baseline HEAD. This
endpoint only returns first-page PR runs; an empty result does not establish that
push runs do not exist. No runner success claimed; no push/PR authorized.

## Kết quả chốt — 2026-10-18 (Asia/Bangkok)

Bằng chứng thực thi bên dưới được tạo ngày 2026-10-17; ngày 18 đối chiếu lại logs/artifacts, không giả định đã chạy lại runtime.

Các kết quả dưới đây thay thế trạng thái thử nghiệm ban đầu trong ma trận audit.
Không tuyên bố full release readiness: GitHub runner cho thay đổi mới và smoke UI
trên browser thật vẫn là các bước bên ngoài được mô tả bên dưới.

| Hạng mục | Kết quả / evidence | Trạng thái |
|---|---|---|
| Audit hạ tầng | CI, Compose, Dockerfiles/ignores, Nginx, health, security, tests, backup/rollback được review trước khi sửa | IMPLEMENTED |
| Docker build | Hai image verify-042 build thành công với Java21 / Node22.12 | VERIFIED LOCALLY |
| Compose | Config thật và config test parse; empty-env bị từ chối; không in config chứa secret | VERIFIED LOCALLY |
| CI configuration | actionlint 1.7.7 exit0; Java21, Node22.12, wrapper, npm ci/caches, tests/build, contents:read; PostGIS service riêng | VERIFIED LOCALLY |
| GitHub runner | Connector không trả PR run cho HEAD baseline; source mới chưa push | BLOCKED (external) |
| Backend Windows | 122 tests, 0 lỗi, 3 PostgreSQL skipped trong lượt H2; ba PostgreSQL tests chạy riêng đạt 3/3 | VERIFIED LOCALLY |
| Backend Linux | 122/122 tests, 0 failures/errors, 0 skipped; runner build lại từ source hiện tại | VERIFIED LOCALLY (Linux container, không phải GitHub) |
| Web | 19 files, 172 tests đạt; TypeScript và production build đạt | VERIFIED LOCALLY |
| REST/SPA/auth | Proxy, login, deep-link refresh, JWT invalid, Backend 502 và phục hồi cùng token | VERIFIED LOCALLY |
| Health/recovery | Cả ba health checks đạt; DB offline trả 503, liveness vẫn 200; phục hồi không đổi JWT | VERIFIED LOCALLY |
| Backup/restore | Synthetic schema/data, Flyway checksum, PostGIS/GiST, quan hệ chat, app login trên DB restored | VERIFIED LOCALLY |
| Realtime | Tests Backend STOMP/Web reconnect; prior two-account/restart confirmation | VERIFIED LOCALLY / VERIFIED MANUALLY (prior) |
| Security | Final Backend/Web: 0 HIGH/CRITICAL theo snapshot DB ghi bên dưới | VERIFIED LOCALLY |
| SBOM | CycloneDX 1.6, Backend 238 / Web 72 components; IDs khớp scan và inspect | VERIFIED LOCALLY |
| Logging | Compose giữ max-size 10m, max-file 5; production INFO; không mở rộng observability | IMPLEMENTED; config reviewed |
| Mobile/public deployment | Không sửa/chạy build/tests; không deploy public | NOT APPLICABLE |

### Thay đổi và bằng chứng

1. **Audit ban đầu:** giữ baseline HEAD và file prompt chưa tracked như phần trên.
   Không tái tạo hạ tầng PROMPT_041, không sửa API/schema hay thêm tính năng sản phẩm.
2. **Kiểm chứng cũ:** giữ xác nhận thủ công của người dùng: Compose build/up,
   hai tài khoản nhắn tin realtime, Backend restart phục hồi không refresh browser.
   Không suy rộng thành mọi failure mode của WebSocket.
3. **CI:** bật ba PostgreSQL/PostGIS tests trước đây bị skip trên runner, bằng
   service/database tổng hợp riêng. Review paths/triggers/permissions/caches và
   validate workflow bằng actionlint. Linux chạy Maven Wrapper; không disable tests.
   Không push/commit/PR hoặc khẳng định GitHub runner đã xanh.
4. **Scan:** Trivy 0.69.3, OS + Java, giữ cả findings có/không có fix; không dùng
   ignore-unfixed. Web ban đầu 49 findings (3 CRITICAL/46 HIGH); Backend 17
   (5 CRITICAL/12 HIGH). Cả hai image cuối có 0 HIGH/CRITICAL, không khẳng định
   lower severities cũng bằng 0 hoặc mọi advisory đều có thể khai thác.
5. **SBOM:** tạo hai CycloneDX, đối chiếu immutable image IDs và SHA256 tại
   artifacts/prompt042/image-evidence.json. SBOM Web runtime chủ yếu là OS packages;
   không phải inventory đầy đủ các thư viện JS đã bundle. Lockfile vẫn là nguồn
   dependency Web. Không commit SBOM lớn hay private dump.
6. **Remediation:** Nginx 1.27.4/Alpine3.21 → Nginx stable1.30.6/Alpine3.24;
   Backend explicit libssl3 update, Spring Framework7.0.9, Tomcat11.0.25,
   PostgreSQL JDBC42.7.12, Jackson BOM2.21.7/3.1.7. Giữ Boot4.1.0 và các major
   application versions. [Triage từng finding](image-vulnerabilities-042.md) ghi
   installed/fixed/severity/exposure/action; bỏ overrides khi Boot BOM có bản vá.
7. **DB recovery defect:** đã tái hiện JWT hợp lệ nhận 401 khi DB offline, có thể
   làm Web đăng xuất. User lookup lỗi DB phát sinh trước MVC advice. Sửa riêng
   JwtAuthenticationFilter trả 503 JSON chung, no-store, Retry-After5; không cấp
   quyền khi DB lỗi. Unit tests và drill thực tế chứng minh cùng JWT hoạt động
   sau DB phục hồi. Invalid JWT vẫn 401. Không sửa reconnect/persistence logic.
8. **Realtime:** giữ Web code; thêm regression Web nhận 503 không gọi logout.
   Test group removal từng race trên Linux vì remove trước SUBSCRIBE hoàn tất;
   chỉ sửa test chờ actual broker registry, giữ nguyên assertions bảo mật. Luôn
   dùng `run --build` để runner không dùng test image cũ. Không tăng timeout để
   che failure, không bỏ security tests.
9. **Restore drill:** dùng project UUID, không host ports/volume thật, PGDATA nằm
   trong layer container riêng để stop/start giữ dữ liệu. Chỉ synthetic users,
   message/location. pg_restore exit0 chưa đủ: đối chiếu Flyway checksum,
   PostGIS/GiST/spatial values, message/user/conversation joins và app startup/login
   trên database restored. Log recovery cuối PASS; tài nguyên drill được dọn.
10. **Ảnh/backup:** deployment.md bổ sung archive read-only, coordinated DB/files
    maintenance, restore vào storage mới, ACL/encryption/retention/off-host copies,
    RPO/RTO và PostGIS compatibility. Không backup cuộc trò chuyện thật vào artifacts.
    Logical dump không gồm ảnh và không phải PITR; không có WAL archiving/PITR mới.
11. **Release checklist:** [release-checklist.md](release-checklist.md), có sequence
    PowerShell, smoke, auth/chat/nearby/privacy/notifications/images/SPA và rollback.
    APP_VERSION dùng release tag/commit; giữ previous images, no-build/pull-never
    cho rollback. Database migration không tự rollback cùng image.
12. **File tạo:** docs/release-verification-042.md, docs/release-checklist.md,
    docs/image-security.md, docs/image-vulnerabilities-042.md,
    scripts/release/compose.verify.yml, scripts/release/verify-recovery.ps1,
    backend/src/test/java/com/geochat/auth/JwtDatabaseRecoveryTest.java.
13. **File sửa:** .github/workflows/ci.yml, .gitignore, docker-compose.yml,
    backend/Dockerfile, backend/pom.xml, JwtAuthenticationFilter.java,
    ChatWebSocketIntegrationTest.java, apps/web/Dockerfile,
    apps/web/src/api/client.test.ts, docs/deployment.md. Prompt người dùng giữ nguyên.
14. **Backend:** xem bảng kết quả và backend-tests.log, postgres-tests.log,
    backend-tests-linux.log. Windows target có file bị khóa và một lượt nạp config
    lỗi; chạy regression trong bản sao source artifacts để tránh xung đột IDE.
    PowerShell được xử lý để stderr warning Mockito không tự ngắt Maven. Không
    dừng tiến trình Java người dùng. Kết quả cuối phải dựa exit code và test summary.
15. **Web:** tests/build mới 172/172. Local Node24.14; Docker builder Node22.12
    npm ci/build đạt. CI Node22.12 tests vẫn cần runner thật cho exact release commit.
16. **Docker:** hai runtime images build thành công; chỉ tag verify-042, không
    thay tag local của ứng dụng thật. Trivy/SBOM gắn với IDs dưới đây, không dùng
    kết quả scan trước rebuild. Không scan nhầm build stage thành runtime.
17. **Validation:** Compose config quiet đạt; required-secrets gate từ chối env
    trống; script PowerShell parse và git diff --check đạt. Không in expanded .env.
18. **Runtime mới:** automated HTTP/container drill, không có thao tác browser thủ
    công mới. Trước đó Web localhost probe fail/IPv4 pass; sửa probe IPv4. DB Unix
    socket probe báo ready trong init PostGIS; sửa TCP probe cho Compose/CI/test.
19. **Chưa verified bên ngoài:** exact GitHub runner và checklist UI smoke; mô tả
    bước/evidence bên dưới. Physical-device checks skipped vì không có thiết bị;
    Mobile bị loại trừ hoàn toàn.
20. **Dữ liệu/rủi ro:** geochat_postgres_data và geochat_chat_images vẫn hiện diện.
    Không xóa volume/down-v, restore/restart DB thật, thay .env hoặc deploy stack
    thật. Sự tồn tại volume không chứng minh integrity sau outage host cũ. Nginx
    root master, DB host port, base tags mutable vẫn là giới hạn đã ghi. Scan chỉ
    theo database snapshot, không thay thế review exploitability/browser smoke.
21. **Milestone tiếp theo:** commit/push/PR do người dùng chủ động, xem CI đúng SHA,
    hoàn tất smoke checklist và backup thật trước release. Chưa mở rộng sang cloud,
    public HTTPS hoặc Mobile. Không tuyên bố full release readiness.

### Failure scenario matrix

| Scenario | Expected/observed | Outcome |
|---|---|---|
| Backend restart | REST cùng JWT phục hồi trong drill; realtime không refresh theo prior user confirmation | PASS (local HTTP + prior manual realtime) |
| DB tạm unavailable | Liveness 200; authenticated operation 503 chung, không lộ DB/credentials | PASS (local) |
| Web restart | Proxy/authenticated request hoạt động với cùng JWT | PASS (local) |
| WebSocket disconnect | Existing subscription-generation/dedup/unread tests; prior restart confirmation | PASS (tested scope); các network mode khác NOT TESTED |
| Invalid JWT | HTTP401 qua Nginx; security regressions | PASS (local) |
| Backend unavailable during API | Proxy502, sau start cùng JWT hoạt động; client safe error handling reviewed | PASS (HTTP); visual UI NOT TESTED |
| Missing secrets | Empty-env Compose bị từ chối trước startup | PASS (Compose gate); direct Java startup NOT TESTED |
| DB restart/recovery | Synthetic data tồn tại, cùng token và service kết nối lại | PASS (local) |

### Immutable artifacts và scanner snapshot

| Image | Immutable ID | SBOM |
|---|---|---|
| geochat-backend:verify-042 | sha256:d10652f524a1243b0f9c922903c514e49e7b9867af548b3829d59fffda989798 | CycloneDX1.6, 238 components |
| geochat-web:verify-042 | sha256:1c2c73ba8e2422d2a1567dcf79801f28f611262b1b738ed1db15586ba45a794c | CycloneDX1.6, 72 components |

Scanner Trivy0.69.3. Main vulnerability DB schema2, nguồn mirror.gcr.io/aquasec/trivy-db:2:
UpdatedAt 2026-10-16T01:13:54Z, DownloadedAt 2026-10-17T04:48:51Z,
NextUpdate 2026-10-17T01:13:54Z. Java DB schema1, nguồn mirror.gcr.io/aquasec/trivy-java-db:1:
UpdatedAt 2026-10-17T01:07:50Z, DownloadedAt 2026-10-17T04:53:05Z,
NextUpdate 2026-10-20T01:07:50Z. Các timestamp này là UTC.

Main DB đã quá NextUpdate khi scan; kết quả zero HIGH/CRITICAL chỉ đúng snapshot
được ghi, không phải cam kết scan mới nhất. Ngày 2026-10-18 Docker pipe
//./pipe/dockerDesktopLinuxEngine không tồn tại, nên refresh/re-scan là BLOCKED
(external runtime). Không tự bật/reset engine vì có thể khởi động dịch vụ thật.
SBOM hashes đã kiểm tra lại, khớp image-evidence.json.

Reports/metadata/version/checksums nằm trong artifacts/prompt042; quy trình tái
lập: [image-security.md](image-security.md). Các lần scan/build/test trước đây
chạy đồng thời gây host OOM/daemon outage/cache lock. Lượt cuối chạy tuần tự,
scanner giới hạn RAM1GB/CPU1/parallel1, Linux test giới hạn heap; không reset Docker.

### External blockers / follow-up

- **GitHub runner:** source chưa push; prompt cấm tự push/PR. Connector chỉ trả
  first-page PR runs và trả danh sách trống cho baseline HEAD, không chứng minh
  không có push runs. Làm theo git/PR commands trong release-checklist.md. Evidence
  mong đợi: link CI đúng SHA mới, backend/web/containers đạt, PostgreSQL tests không
  skipped. Không thay local verification thành VERIFIED IN CI.
- **Smoke UI / release của người dùng:** trên môi trường dự định release, làm các
  mục login/logout, DIRECT/GROUP, realtime/notification/unread, Nearby privacy,
  upload/download ảnh, SPA refresh, reconnect và persistence trong checklist. Ghi
  release image IDs, browser, scenario và PASS/FAIL; expected là UI dùng lại được,
  không duplicate events và không lộ precise location trái quy tắc. Agent không
  có browser session đăng nhập để xác minh visual flow; không tự deploy dữ liệu thật.
- **Dữ liệu thật:** trước deployment, tự tạo/kiểm tra backup DB+ảnh theo deployment.md.
  Synthetic drill không thay thế backup thật hoặc chứng minh integrity DB hiện tại.


### Refresh scan trước release khi Docker hoạt động

Đầu tiên chạy docker info; chỉ tiếp tục khi exit0. Không cần khởi động stack thật.
Nếu geochat-v042-scanner còn tồn tại, dùng các lệnh dưới; nếu không, tạo scanner
riêng theo image-security.md. Kiểm tra exit code từng lệnh.

```powershell
docker info
docker image inspect --format '{{.Id}}' geochat-backend:verify-042 geochat-web:verify-042
# So khớp IDs với bảng trên trước khi dùng lại SBOM.
docker start geochat-v042-scanner
docker exec geochat-v042-scanner trivy image --cache-dir /tmp/trivy-cache --db-repository ghcr.io/aquasecurity/trivy-db:2 --download-db-only
docker exec geochat-v042-scanner trivy image --parallel 1 --timeout 20m --cache-dir /tmp/trivy-cache --db-repository ghcr.io/aquasecurity/trivy-db:2 --scanners vuln --severity HIGH,CRITICAL --format json --output /out/backend-scan.json geochat-backend:verify-042
docker exec geochat-v042-scanner trivy image --parallel 1 --timeout 20m --cache-dir /tmp/trivy-cache --db-repository ghcr.io/aquasecurity/trivy-db:2 --scanners vuln --severity HIGH,CRITICAL --format json --output /out/web-scan.json geochat-web:verify-042
docker exec geochat-v042-scanner trivy --cache-dir /tmp/trivy-cache --version
docker cp geochat-v042-scanner:/tmp/trivy-cache/db/metadata.json artifacts/prompt042/trivy-db-metadata.json
docker stop geochat-v042-scanner
# Dọn đúng project test nếu còn; không xóa volume của ứng dụng.
docker compose -p geochat-v042-tests -f scripts/release/compose.verify.yml down
```

Expected evidence: main DB UpdatedAt/NextUpdate được đối chiếu với thời điểm chạy,
hai scan JSON exit0 với toàn bộ HIGH/CRITICAL đã triage. Nếu feed vẫn trả snapshot
cũ, ghi rõ feed lag và giữ release gate chưa đạt. Nếu rebuild/thay image ID, tạo
lại SBOM và image-evidence.json; không gắn SBOM cũ sang image mới.

Chạy lại toàn bộ Backend Linux khi source thay đổi:

```powershell
docker compose -p geochat-v042-tests -f scripts/release/compose.verify.yml --profile tests run --build --rm backend-tests
docker compose -p geochat-v042-tests -f scripts/release/compose.verify.yml down
```

Không có test container nào được yêu cầu chạy khi engine chưa sẵn sàng. Cleanup
project test đã được gọi sau test run; trạng thái cleanup hiện tại chưa kiểm tra
lại được khi engine offline. Hai volume thật từng được xác nhận còn tồn tại ngày17.

Phần triển khai và kiểm chứng local đã hoàn tất theo evidence ghi trên; mọi
verification chưa thực hiện đã được phân loại external blocker với bước/evidence
cụ thể. Chưa tuyên bố release-ready trước fresh scan, GitHub CI và smoke UI.

PROMPT_042 COMPLETE

