# PROMPT 041 — Audit hạ tầng triển khai ban đầu

Ngày audit: 2026-10-16. Repository được kiểm tra trước khi thay đổi.

| Hạng mục | Phân loại ban đầu | Bằng chứng | Hành động tối thiểu |
|---|---|---|---|
| PostgreSQL/PostGIS Compose | ALREADY IMPLEMENTED | `docker-compose.yml` dùng `postgis/postgis:16-3.4` và volume `postgres_data` | Giữ image, volume và biến DB; thêm health/network/logging |
| Backend Dockerfile | MISSING | Không có Dockerfile | Thêm multi-stage Java 21, Maven Wrapper, non-root runtime |
| Web Dockerfile | MISSING | Chỉ có Vite development setup | Thêm Node build và Nginx runtime |
| Reverse proxy | MISSING | Browser gọi backend port 8080 trực tiếp | Thêm same-origin `/api/` và `/ws` proxy |
| SPA/static cache | MISSING | Không có production web server | Thêm fallback route, asset 404 và cache riêng |
| Environment template | NEEDS IMPROVEMENT | Có DB/JWT/CORS nhưng chưa có Web port và image version | Bổ sung đúng biến Compose dùng |
| Production Spring profile | ALREADY IMPLEMENTED | `application-prod.yml` bắt buộc DB/JWT/CORS | Giữ bảo vệ; thêm graceful shutdown |
| Backend health | ALREADY IMPLEMENTED | Public `GET /api/health`, payload tối thiểu | Dùng lại làm liveness container |
| Database/Web health | MISSING | Compose chưa có healthcheck | Thêm `pg_isready` và local Nginx health |
| Log rotation | MISSING | Docker log không có giới hạn | Thêm `max-size` và `max-file` |
| GitHub Actions | MISSING | Không có `.github/workflows` | Thêm Backend, Web và container validation |
| Backup/restore | MISSING | Không có quy trình vận hành | Viết hướng dẫn PowerShell an toàn |
| Mobile | NOT APPLICABLE | Bị loại khỏi phạm vi | Không sửa, build hoặc test |

Không có thay đổi schema hoặc thao tác phá hủy dữ liệu được yêu cầu.
