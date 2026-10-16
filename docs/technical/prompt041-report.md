# Báo cáo PROMPT 041 — Deployment & Monitoring Foundation

Ngày hoàn thành: 2026-10-16.

## 1. Audit kiến trúc triển khai hiện có

Trước thay đổi, Compose chỉ chạy `postgis/postgis:16-3.4` với volume `postgres_data`. Backend đã có production profile và `/api/health`; chưa có application images, proxy production, health checks Compose, CI hoặc hướng dẫn vận hành. Chi tiết nằm trong `prompt041-deployment-audit.md`.

## 2. Hạ tầng đã có và được tái sử dụng

Giữ nguyên PostgreSQL/PostGIS 16-3.4, volume database, Flyway startup, biến DB hiện hành, JWT/CORS production requirements và health endpoint. Không tạo endpoint health trùng lặp.

## 3. Dockerfiles

Backend dùng multi-stage Eclipse Temurin Java 21, Maven Wrapper, build executable JAR, runtime JRE riêng và user `geochat` không phải root. Web dùng Node 22.12 với `npm ci`, Vite production build và Nginx Alpine runtime. Cả hai có `.dockerignore`; Web context sau tối ưu còn khoảng 637 KB thay vì chứa thư mục artifact 403 MB.

## 4. Docker Compose

Compose hiện chạy `web`, `backend`, `postgres`; giữ persistent `postgres_data` và thêm `chat_images`. Chỉ Web publish cổng ứng dụng. Backend nằm sau proxy, dùng profile `prod`, đợi DB healthy và có graceful stop. Hai bridge networks tách luồng Web/Backend và Backend/DB. Log mỗi service giới hạn 5 x 10 MB.

## 5. Reverse proxy Web

Nginx phục vụ SPA, proxy `/api/` đến Backend và hỗ trợ Upgrade tại `/ws`. Route SPA refresh trả `index.html`; `/assets/` thiếu trả 404 thay vì HTML. HTML không cache, hashed assets cache immutable. Các header `nosniff`, frame deny, referrer và permissions policy đã được thêm.

## 6. Environment và secret

`.env.example` thêm `WEB_PORT` và `APP_VERSION`. Compose bắt buộc DB name/user/password, JWT secret và CORS origin cho Backend; secret không được COPY vào image. Production Web dùng relative same-origin. `VITE_*` là cấu hình công khai lúc build; DB/JWT là server-only runtime values. `.env` thật không bị sửa.

## 7. Health checks

Postgres dùng `pg_isready` đúng DB/user. Backend gọi public lightweight `/api/health`; đây là HTTP liveness, không được mô tả là deep readiness. Web dùng local `/healthz` và `wget` có sẵn trong Alpine. Dependency conditions dùng trạng thái healthy thay vì chỉ startup order.

## 8. Logging và monitoring

Ứng dụng ghi stdout/stderr; production log level tránh SQL/WebSocket DEBUG. Compose cấu hình rotation. `docs/deployment.md` có lệnh `docker compose ps`, health inspect, logs theo service, `docker stats`, restart và disk diagnostics.

## 9. GitHub Actions

Workflow có quyền `contents: read`, chạy trên pull request và push vào các branch đang tồn tại `develop`, `main`, `master`. Job Backend dùng Java 21/Maven Wrapper; Web dùng Node 22.12, `npm ci`, test và build; container job validate Compose và build cả hai image. Không publish image, deploy hoặc chạy Mobile.

## 10. Backup/restore

Tài liệu dùng `pg_dump -Fc` trong container rồi `docker compose cp` ra host, tránh PowerShell binary redirection. Restore chỉ hướng dẫn vào `geochat_restore_test`, kiểm tra Flyway history và dữ liệu đại diện. Drill trên PostgreSQL tmpfs đã dump ra file host, restore vào database disposable và xác nhận giá trị `verified`; không dùng dữ liệu người dùng.

## 11. Update/rollback

Hướng dẫn gồm test, optional backup, versioned `APP_VERSION`, rebuild, restart từng service, health/log checks. Rollback chọn image tag cũ và nhấn mạnh application rollback không tự rollback Flyway migration.

## 12. File tạo mới

- `backend/Dockerfile`, `backend/.dockerignore`.
- `apps/web/Dockerfile`, `apps/web/.dockerignore`, `apps/web/nginx.conf`.
- `.github/workflows/ci.yml`.
- `docs/deployment.md`.
- Hai tài liệu audit/report Prompt 041.

## 13. File chỉnh sửa

- `docker-compose.yml`, `.env.example`, `README.md`.
- `backend/src/main/resources/application-prod.yml`.
- `apps/web/src/api/client.ts` để production mặc định same-origin, development vẫn dùng port 8080.

## 14. Backend tests

**VERIFIED LOCALLY:** Maven Wrapper chạy 120 test, 0 failure, 0 error, 3 skipped; BUILD SUCCESS. Image package stage cũng BUILD SUCCESS.

## 15. Web tests/build

**VERIFIED LOCALLY:** 19 test files và 171 tests đạt. TypeScript + Vite production build đạt với 66 modules.

## 16. Docker build

**VERIFIED LOCALLY:** `geochat-backend:local` và `geochat-web:local` build thành công. Backend image chạy với user `geochat`; Web runtime dùng Nginx, không dùng Vite dev server.

## 17. Compose validation

**VERIFIED LOCALLY:** `docker compose --env-file .env.example config --quiet` trả exit code 0. Required production values được truyền từ template trong lần validation.

## 18. Smoke tests đã thực hiện

- Web `/healthz`: 200 và body `ok`.
- SPA deep route `/messages/example`: 200 HTML.
- Asset không tồn tại: 404.
- Security/cache headers: xác nhận `nosniff`, `DENY`, `no-store`.
- Stack disposable dùng PostgreSQL tmpfs và network tên ngẫu nhiên: DB ready, Backend production image healthy, Flyway tạo 18 history rows.
- REST qua Nginx `/api/health`: 200 `application/json`.
- WebSocket application behavior được bao phủ bởi Backend regression; handshake container xuyên Nginx chưa được kiểm tra bằng STOMP client riêng.

Stack smoke được cleanup theo chính container ID đã tạo; không dùng volume persistent.

## 19. Bảo toàn dữ liệu hiện có

Không chạy `down -v`, drop database, restore hoặc thay đổi volume hiện có. Smoke database dùng `tmpfs`; không có migration mới. `postgres_data` giữ nguyên trong Compose.

## 20. Mobile compatibility

Không sửa, build, typecheck hoặc test Mobile. REST routes và WebSocket destinations hiện có được giữ nguyên.

## 21. Giới hạn đã biết

- CI workflow được tạo nhưng chưa thể xác nhận trên GitHub runner cho đến khi push.
- Health Backend là liveness HTTP, không kiểm tra sâu DB trong mỗi lần probe.
- Compose environment không phải enterprise secret manager; Docker host administrators có thể xem environment.
- Backup/restore đã verify bằng dữ liệu disposable; chưa thực hiện recovery drill với kích thước và extension set của dữ liệu staging/production thật.
- Không có TLS/domain termination trong milestone này.
- Base image pin theo version tag và build ghi nhận digest đã resolve; digest chưa khóa trực tiếp trong Dockerfile để vẫn hỗ trợ cập nhật patch có kiểm soát.

## 22. Milestone tiếp theo

Chạy CI trên pull request thật, thực hiện backup/restore drill định kỳ trên dữ liệu staging, thêm TLS tại edge, vulnerability scanning/SBOM cho images và một STOMP smoke client qua reverse proxy. Khi triển khai nhiều instance, bổ sung shared rate-limit store và monitoring tập trung phù hợp tải thực tế.

PROMPT_041 COMPLETE
