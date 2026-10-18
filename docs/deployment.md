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
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Sửa `.env`: đặt `DB_NAME`, `DB_USERNAME`, mật khẩu DB riêng, `JWT_SECRET` ngẫu nhiên tối thiểu 32 byte và `CORS_ALLOWED_ORIGINS` đúng origin Web, ví dụ `http://localhost:8081`. `WEB_PORT` là cổng công khai. `APP_VERSION` nên là Git commit hoặc release tag khi triển khai thật.

Compose truyền secret qua environment; người có quyền trên Docker host có thể xem chúng. `.env` phù hợp máy đơn nhưng không thay thế production secret manager. Không commit `.env`.

Web production dùng same-origin nên `VITE_API_BASE_URL` để trống trong image build. Backend secrets chỉ có lúc container chạy và không đi vào Web bundle hoặc image layers.

## Triển khai lần đầu

```powershell
docker compose --env-file .env config --quiet
docker compose --env-file .env build
docker compose --env-file .env up -d
docker compose ps
```
## Dừng và xóa hẳn các container, network
    docker compose down
## Chỉ tạm dừng các container

`docker compose stop` và `docker compose start` giữ container và volume.
Không xóa volume database hoặc ảnh khi cập nhật, rollback hay kiểm thử.
`docker compose down -v` xóa tất cả dữ liệu cũ (database MySQL/Postgres)

Mở `http://localhost:8081`. Kiểm tra Web và API:

```powershell
Invoke-WebRequest http://localhost:8081/healthz
Invoke-RestMethod http://localhost:8081/api/health
```

Đăng nhập rồi mở chat để kiểm tra STOMP `/ws`; xem Network của browser phải có handshake `101 Switching Protocols`. Flyway chạy khi Backend khởi động và validate/apply migration hiện có. Backend chỉ khởi động sau khi `pg_isready` thành công. Health Backend hiện chỉ xác minh tiến trình HTTP phản hồi, không phải kiểm tra sâu mọi dependency.

## Theo dõi và log

PROMPT_042 đã kiểm chứng outage/recovery trên stack riêng bằng dữ liệu tổng hợp.
Khi user lookup không truy cập được DB, Backend trả HTTP 503 với thông báo chung
và `Retry-After: 5`; Web giữ phiên đăng nhập để thử lại sau khi DB phục hồi.
JWT thật sự không hợp lệ vẫn trả 401. `/api/health` là HTTP liveness, có thể vẫn
200 khi DB offline, không phải database readiness. Trạng thái `unhealthy` không
tự làm Docker Compose restart container; restart policy xử lý việc tiến trình dừng.
Xem [báo cáo release](release-verification-042.md) và [checklist](release-checklist.md).

```powershell
docker compose ps
docker inspect --format='{{json .State.Health}}' geochat-backend-1
docker compose logs --tail 200 backend
docker compose logs --tail 200 web
docker compose logs --tail 200 postgres
docker stats
docker compose restart backend
docker compose --env-file .env config --quiet
docker system df
```

Tên container thực tế có prefix theo tên thư mục; lấy tên bằng `docker compose ps`. Docker JSON logs được giới hạn 5 file, mỗi file 10 MB. Ứng dụng ghi stdout/stderr. Production giữ SQL, security, messaging và WebSocket ở INFO để tránh message body hoặc token trong DEBUG logs.

## Backup PostgreSQL

Tạo thư mục trên host và dùng `docker compose exec -T`; `pg_dump` custom format là binary nên ghi bằng `--file` trong container rồi `docker compose cp`, tránh PowerShell redirection làm hỏng stream:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dbUser = 'geochat' # use DB_USERNAME from .env
$dbName = 'geochat' # use DB_NAME from .env
New-Item -ItemType Directory -Force .\backups | Out-Null
docker compose exec -T postgres pg_dump -h localhost -U $dbUser -d $dbName -Fc --file "/tmp/geochat-$stamp.dump"
docker compose cp "postgres:/tmp/geochat-$stamp.dump" ".\backups\geochat-$stamp.dump"
docker compose exec -T postgres rm "/tmp/geochat-$stamp.dump"
Get-FileHash ".\backups\geochat-$stamp.dump" -Algorithm SHA256
```

Các lệnh trên dùng kết nối localhost bên trong container với cấu hình trust mặc định của image; `POSTGRES_PASSWORD` không tự trở thành `PGPASSWORD`. Nếu đã siết `pg_hba.conf`, dùng `.pgpass` có quyền đọc hạn chế hoặc cơ chế secret phù hợp. Không ghi mật khẩu vào command/history. Hạn chế quyền đọc thư mục backup bằng NTFS ACL và lưu một bản ngoài Docker host; backup chứa dữ liệu cá nhân dù không có secret cấu hình.

## Kiểm tra restore an toàn

Chỉ restore vào container riêng, không dùng service `postgres` của stack đang hoạt động. Ví dụ sau tạo container không có host port, dữ liệu trong writable layer riêng, default volume bị che bằng tmpfs:

```powershell
$restoreName = 'geochat-restore-' + [Guid]::NewGuid().ToString('N').Substring(0, 10)
docker run -d --name $restoreName --network none --tmpfs /var/lib/postgresql/data -e PGDATA=/var/lib/postgresql/restore-data -e POSTGRES_USER=restore_user -e POSTGRES_DB=restore_db -e POSTGRES_HOST_AUTH_METHOD=trust postgis/postgis:16-3.4
# Chờ pg_isready thành công trước khi tiếp tục; kiểm tra exit code từng lệnh.
docker exec $restoreName pg_isready -U restore_user -d restore_db
docker cp ".\backups\geochat-YYYYMMDD-HHMMSS.dump" "${restoreName}:/tmp/restore.dump"
docker exec $restoreName pg_restore -U restore_user -d restore_db --no-owner --no-privileges --exit-on-error /tmp/restore.dump
docker exec $restoreName psql -U restore_user -d restore_db -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM flyway_schema_history; SELECT PostGIS_Version(); SELECT count(*) FROM users; SELECT count(*) FROM messages;"
# Chỉ sau khi lưu kết quả: xóa đúng container disposable có tên vừa tạo.
docker rm -f $restoreName
```

Phải dùng PostgreSQL/PostGIS tương thích với `16-3.4`. Ngoài exit code, đối chiếu Flyway history/checksum, bảng/index không gian, số lượng dữ liệu mong đợi và khóa ngoại; kiểm tra Backend tương ứng có thể kết nối. `--no-owner --no-privileges` phù hợp drill với role riêng, không kiểm chứng việc khôi phục grants/roles production. Không đưa cuộc trò chuyện riêng vào artifact kiểm thử. Drill tự động dùng hoàn toàn dữ liệu tổng hợp: [verify-recovery.ps1](../scripts/release/verify-recovery.ps1). Restore production cần downtime, backup mới, kế hoạch rollback và xác nhận riêng.

## Giới hạn backup và ảnh chat

`pg_dump` tạo snapshot logic nhất quán của database tại thời điểm dump, không
bao gồm file ảnh, role toàn cluster hoặc WAL/PITR. Chọn lịch/retention theo lượng
dữ liệu chấp nhận mất (RPO), chẳng hạn 7 bản ngày và 4 bản tuần; đo thời gian
restore thực tế để ước lượng RTO. Disk hỏng, mất máy hoặc ransomware có thể làm
mất cả database và backup trên cùng host. Lưu bản ngoài máy, mã hóa bằng công cụ
backup được quản lý khóa riêng và thử phục hồi định kỳ. Hash phát hiện thay đổi,
không thay thế mã hóa hoặc kiểm soát truy cập. Giữ phiên bản PostgreSQL/PostGIS
tương thích và kiểm chứng quyền sở hữu/grants khi phục hồi thật.

Database có thể chứa đường dẫn ảnh trong `chat_images`; dump DB không chứa ảnh.
Để backup phối hợp, lên lịch maintenance và chủ động dừng Backend để ngừng ghi,
dump DB theo hướng dẫn trên rồi archive volume ảnh chỉ đọc, cuối cùng bật lại
Backend. Các lệnh sau dành cho maintenance được chủ động lên lịch, không chạy
trong kiểm thử release tự động:

```powershell
$backendId = docker compose ps -q backend
if ($LASTEXITCODE -ne 0 -or -not $backendId) { throw 'Backend container not found' }
$imageVolume = docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/var/chat-images"}}{{.Name}}{{end}}{{end}}' $backendId
if ($LASTEXITCODE -ne 0 -or -not $imageVolume) { throw 'Chat image volume not found' }
New-Item -ItemType Directory -Force .\backups | Out-Null
$backupDir = (Resolve-Path .\backups).Path
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
docker compose stop backend
# Thực hiện pg_dump + docker compose cp ở trên, kiểm tra exit code.
try {
    docker run --rm --network none --mount "type=volume,src=$imageVolume,dst=/images,readonly" --mount "type=bind,src=$backupDir,dst=/backup" alpine:3.21 tar -czf "/backup/chat-images-$stamp.tar.gz" -C /images .
    if ($LASTEXITCODE -ne 0) { throw 'Image archive failed' }
    Get-FileHash ".\backups\chat-images-$stamp.tar.gz" -Algorithm SHA256
} finally { docker compose start backend }
```

Chỉ chạy archive sau khi dump thành công; nếu dump lỗi thì bật lại Backend và
dừng quy trình. Giữ dump và archive cùng đợt trong manifest (thời gian, hash,
APP_VERSION/image ID). Bao gồm cả avatar nếu cùng thư mục storage. Kiểm tra tar
trong container riêng trước; restore vào thư mục/volume mới, kiểm tra owner/quyền
và đối chiếu attachment storage key rồi cho Backend thử nghiệm truy cập. Không
giải nén đè volume đang dùng. Chuyển sang bộ DB + ảnh đã khôi phục trong maintenance
được duyệt; giữ bộ cũ cho rollback. Khôi phục riêng DB có thể tạo link ảnh bị thiếu.

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
docker compose --env-file .env up -d --no-build --pull never --no-deps backend web
docker compose ps
docker compose logs --tail 200 backend web
```

Mỗi release nên build với `APP_VERSION` bất biến như commit SHA. Rollback image không rollback database migration. Nếu migration không tương thích ngược, cần phục hồi backup trong maintenance window theo quy trình được duyệt; không tự động restore vào DB đang chạy.

## Xử lý lỗi

| Hiện tượng | Kiểm tra |
|---|---|
| Thiếu JWT/DB/CORS | `docker compose config --quiet`; Compose và profile `prod` phải dừng với thông báo biến thiếu |
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
