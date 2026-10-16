# Triển khai GeoChat bằng Docker Compose

## Kiến trúc

```text
Browser -> Web/Nginx : WEB_PORT
              |-- static React SPA
              |-- /api/* -> backend:8080
              `-- /ws    -> backend:8080 (WebSocket upgrade)
Backend -> postgres:5432
```

Compose tạo image từ Dockerfile, chạy image thành container, giữ dữ liệu trong volume và nối dịch vụ qua network riêng của project. Health check báo khả năng phản hồi của từng container. Build context là thư mục Docker được phép đọc khi build.

Các file chính là `docker-compose.yml`, `backend/Dockerfile`, `apps/web/Dockerfile`, `apps/web/nginx.conf` và `.env`. Biến môi trường cấu hình container lúc chạy; riêng `VITE_*` được nhúng công khai lúc build và không được chứa secret.

## Điều kiện

- Windows PowerShell.
- Docker Desktop với Docker Compose v2.
- Git. Java/Node chỉ cần khi chạy validation ngoài container.
- Không dùng `docker compose down -v`: tùy chọn này xóa volume database.

## Cấu hình

Từ repository root:

```powershell
Copy-Item .env.example .env
```

Sửa `.env`: đặt `DB_NAME`, `DB_USERNAME`, mật khẩu DB riêng, `JWT_SECRET` ngẫu nhiên tối thiểu 32 byte và `CORS_ALLOWED_ORIGINS` đúng origin Web, ví dụ `http://localhost:8081`. `WEB_PORT` là cổng công khai. `APP_VERSION` nên là Git commit hoặc release tag khi triển khai thật.

Compose truyền secret qua environment; người có quyền trên Docker host có thể xem chúng. `.env` phù hợp máy đơn nhưng không thay thế production secret manager. Không commit `.env`.

Web production dùng same-origin nên `VITE_API_BASE_URL` để trống trong image build. Backend secrets chỉ có lúc container chạy và không đi vào Web bundle hoặc image layers.

## Triển khai lần đầu

```powershell
docker compose --env-file .env config --quiet
docker compose --env-file .env build
#-d là chạy ngầm sau chỉ cần docker compose down
docker compose --env-file .env up -d
docker compose ps
```
## Dừng và xóa hẳn các container, network
    docker compose down
## Chỉ tạm dừng các container
    docker compose stop/start
## Xóa sạch cả dữ liệu cũ (database MySQL/Postgres)
    docker compose down -v

```

Mở `http://localhost:8081`. Kiểm tra Web và API:

```powershell
Invoke-WebRequest http://localhost:8081/healthz
Invoke-RestMethod http://localhost:8081/api/health
```

Đăng nhập rồi mở chat để kiểm tra STOMP `/ws`; xem Network của browser phải có handshake `101 Switching Protocols`. Flyway chạy khi Backend khởi động và validate/apply migration hiện có. Backend chỉ khởi động sau khi `pg_isready` thành công. Health Backend hiện chỉ xác minh tiến trình HTTP phản hồi, không phải kiểm tra sâu mọi dependency.

## Theo dõi và log

```powershell
docker compose ps
docker inspect --format='{{json .State.Health}}' geochat-backend-1
docker compose logs --tail 200 backend
docker compose logs --tail 200 web
docker compose logs --tail 200 postgres
docker stats
docker compose restart backend
docker compose config
docker system df
```

Tên container thực tế có prefix theo tên thư mục; lấy tên bằng `docker compose ps`. Docker JSON logs được giới hạn 5 file, mỗi file 10 MB. Ứng dụng ghi stdout/stderr. Production giữ SQL, security, messaging và WebSocket ở INFO để tránh message body hoặc token trong DEBUG logs.

## Backup PostgreSQL

Tạo thư mục trên host và dùng `docker compose exec -T`; `pg_dump` custom format là binary nên ghi thẳng bằng `--file` vào thư mục bind tạm, tránh PowerShell redirection làm hỏng stream:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dbUser = 'geochat' # use DB_USERNAME from .env
$dbName = 'geochat' # use DB_NAME from .env
New-Item -ItemType Directory -Force .\backups | Out-Null
$backupPath = (Resolve-Path .\backups).Path
docker compose exec -T postgres pg_dump -h localhost -U $dbUser -d $dbName -Fc --file "/tmp/geochat-$stamp.dump"
docker compose cp "postgres:/tmp/geochat-$stamp.dump" ".\backups\geochat-$stamp.dump"
docker compose exec -T postgres rm "/tmp/geochat-$stamp.dump"
Get-FileHash ".\backups\geochat-$stamp.dump" -Algorithm SHA256
```

Mật khẩu không xuất hiện trong command vì container đã có `POSTGRES_PASSWORD`. Hạn chế quyền đọc thư mục backup và lưu một bản ngoài Docker host.

## Kiểm tra restore an toàn

Chỉ restore vào database disposable, không dùng database đang hoạt động:

```powershell
$dbUser = 'geochat' # use DB_USERNAME from .env
docker compose exec -T postgres createdb -h localhost -U $dbUser geochat_restore_test
docker compose cp ".\backups\geochat-YYYYMMDD-HHMMSS.dump" postgres:/tmp/restore.dump
docker compose exec -T postgres pg_restore -h localhost -U $dbUser -d geochat_restore_test --clean --if-exists --exit-on-error /tmp/restore.dump
docker compose exec -T postgres psql -h localhost -U $dbUser -d geochat_restore_test -c "SELECT count(*) FROM flyway_schema_history;"
docker compose exec -T postgres psql -h localhost -U $dbUser -d geochat_restore_test -c "SELECT count(*) FROM users;"
docker compose exec -T postgres rm /tmp/restore.dump
```

Phải dùng PostgreSQL/PostGIS tương thích với `16-3.4`. Sau khi xác minh, xóa database test chỉ khi chắc chắn tên là `geochat_restore_test`. Restore schema có Flyway history; không tự chạy Flyway trên bản restore trước khi kiểm tra version. Restore production cần downtime, backup mới, kế hoạch rollback và xác nhận riêng.

## Cập nhật

```powershell
git pull
Set-Location backend; .\mvnw.cmd test; Set-Location ..
Set-Location apps\web; npm ci; npm test; npm run build; Set-Location ..\..
docker compose --env-file .env config --quiet
docker compose --env-file .env build
docker compose --env-file .env up -d --no-deps backend
docker compose --env-file .env up -d --no-deps web
docker compose ps
```

Backup DB trước migration có rủi ro. Không xóa `postgres_data` hoặc `chat_images`. Dùng `docker compose up -d` nếu dependency cũng thay đổi.

## Rollback

Đặt `APP_VERSION` thành tag image đã build và còn trên host, rồi chạy:

```powershell
docker image ls geochat-backend
docker image ls geochat-web
docker compose --env-file .env up -d --no-deps backend web
docker compose ps
docker compose logs --tail 200 backend web
```

Mỗi release nên build với `APP_VERSION` bất biến như commit SHA. Rollback image không rollback database migration. Nếu migration không tương thích ngược, cần phục hồi backup trong maintenance window theo quy trình được duyệt; không tự động restore vào DB đang chạy.

## Xử lý lỗi

| Hiện tượng | Kiểm tra |
|---|---|
| Thiếu JWT/DB/CORS | `docker compose config`; Compose và profile `prod` phải dừng với thông báo biến thiếu |
| PostgreSQL chưa ready | `docker compose ps`; `docker compose logs postgres`; kiểm tra disk và credentials |
| Flyway lỗi | `docker compose logs backend`; kiểm tra migration checksum/version, không sửa lịch sử đã áp dụng |
| Backend unhealthy | Gọi `/api/health`, xem Backend/Postgres log và network `docker network ls` |
| Web unhealthy | Gọi `/healthz`, xem Nginx log và file build |
| API 502 | Backend chưa healthy hoặc Nginx không resolve service `backend` |
| WebSocket lỗi | Kiểm tra handshake `/ws`, header Upgrade và Backend log |
| Port bị chiếm | Đổi `WEB_PORT` hoặc `DB_PORT` trong `.env` |
| API URL sai/stale | Rebuild Web; Vite variables là build-time. Production chuẩn dùng same-origin |
| Hết disk | `docker system df`; chỉ prune artifact không dùng sau khi kiểm tra, không xóa volume DB |

## CI

`.github/workflows/ci.yml` chạy trên pull request và push vào `develop`, `main`, `master`. Backend dùng Java 21 và Maven Wrapper; Web dùng Node 22.12, `npm ci`, tests và production build. Job container validate Compose và build cả hai image, không publish và không dùng production credentials. Mobile không nằm trong workflow.
