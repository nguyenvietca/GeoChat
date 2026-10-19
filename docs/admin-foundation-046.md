# Admin Foundation — nội dung của AI_promt/prompt_045.md

File yêu cầu tên045 nhưng tiêu đề/nội dung là **PROMPT_046**; SMS OTP045 được hoãn.
Triển khai theo nội dung Admin046, không thêm SMS, geographic analytics hoặc Mobile.

## Audit và kế hoạch trước khi sửa

| Yêu cầu | Phân loại | Thành phần tái sử dụng/thay đổi |
|---|---|---|
| Role USER/ADMIN/SUPER_ADMIN, status ACTIVE/INACTIVE/LOCKED | ALREADY IMPLEMENTED | User, V20/V21; không tạo role/status columns mới |
| Backend authorization/current JWT authorities | REUSABLE | SecurityConfig, AccountPrincipal, UserDetailsService, JwtAuthenticationFilter |
| Suspension, auth_version, optimistic row version | REUSABLE | AccountLifecycleService, transactional AccessChanged event |
| STOMP current-status/version checks, close sockets after commit | REUSABLE | StompAuthenticationChannelInterceptor/WebSocketSessionRegistry |
| Google/Facebook identity và JWT issuance | ALREADY IMPLEMENTED | Giữ nguyên043/044, không dùng provider email để cấp quyền |
| Admin namespace, overview, users query/block/unblock | NEEDS EXTENSION | Giữ endpoints cũ; thêm filter/detail/audit và aliases |
| /admin layout/guard, user actions/dialog focus | REUSABLE | Mở rộng layout, pagination, bảng/detail/audit |
| User email/date/provider search và detail DTO | MISSING | AdminQueries dùng JDBC projection + provider batch |
| Append-only account_actions | NEEDS EXTENSION | Tái sử dụng bảng V20, thêm status/role before/after và indexes |
| Operator grant/revoke existing user ID | MISSING | Non-Web entry point, exact confirmation, atomic audit |
| Explicit initial seed bootstrap | REUSABLE | SuperAdminBootstrap giữ compatibility và thêm audit |
| Reliable last-login timestamp | MISSING | Không đoán hoặc tạo số liệu giả; không hiển thị last login |
| CI/Web/backend test infrastructure | REUSABLE | Jobs hiện có tự chạy tests mới; chưa có GitHub runner result |

Kế hoạch đã trình bày trước thay đổi: mở rộng API/audit hiện có → hoàn thiện Web
Admin → security/regression tests và Docker khi daemon có sẵn. Không tạo module
user khác hoặc copy các luồng OAuth. Không thêm dependency.

## Authorization và session

Tất cả `/api/v1/admin/**` yêu cầu ADMIN/SUPER_ADMIN ở Spring Security; endpoint
conversation có sẵn vẫn SUPER_ADMIN-only. Không mở role-management HTTP API/UI.
Register/profile bỏ qua role do browser gửi; tests cũ tiếp tục xác minh điều này.
JWT không được tin để cung cấp quyền Admin: mỗi REST request nạp account hiện tại
từ database và kiểm tra role/status/authVersion. User thường nhận403, thiếu/invalid
JWT nhận401. In-flight requests đã được xác thực có thể hoàn tất; requests mới
không tiếp tục được sử dụng quyền đã thu hồi.

Web AdminLayout kiểm tra session restore, active role và gọi profile thật trước
khi mount nội dung Admin. Kiểm tra lại trên navigation/focus và mỗi30 giây; không
nhấp nháy nội dung trong lần xác minh đầu. Backend là authority; role ở Web không
cấp quyền cho bất kỳ API nào.401 đi qua cleanup session có sẵn;403/không xác minh
được hiển thị lỗi an toàn và Retry. Không có Admin data request trước khi guard đạt.

## APIs và dữ liệu

| Endpoint | Nội dung |
|---|---|
| GET /api/v1/admin/overview | Counts hiện có + newUsers7Days |
| GET /api/v1/admin/users | query,status,provider,after,before,page,size |
| GET /api/v1/admin/users/{id} | Profile read-only, providers, recent20 account actions |
| POST /api/v1/admin/users/{id}/suspend | `{reason}`; alias của block hiện có |
| POST /api/v1/admin/users/{id}/reactivate | `{reason}`; alias của unblock hiện có |
| POST /api/v1/admin/users/{id}/block, /unblock | Giữ tương thích, cùng service |
| GET /api/v1/admin/audit-logs | action,actor,target,after,before,page,size |

Pagination: page0–10000, size1–100 (default20), vượt giới hạn trả400. Danh sách
sort created_at DESC,id DESC; audit cũng dùng cặp timestamp/id để ổn định khi trùng
thời gian. Response giữ `items/hasMore` và bổ sung total/page/size. Dates là UTC
Instant, after inclusive và before exclusive; invalid interval trả400.

User search case-insensitive username/email/display name, tối đa100 ký tự;
LIKE escapes literal `%`, `_`, `!`. Tất cả values bind parameters, SQL fragments
chỉ được tạo từ allowlist. Provider filter PASSWORD/GOOGLE/FACEBOOK dùng flag hoặc
EXISTS identity. List dùng ba queries bounded: count, DTO page, provider batch;
không hydrate full User entities hoặc N+1 identities. Detail chỉ lấy một user và
audit20 dòng. DTO không chứa password/hash, JWT/authVersion, provider subject/token,
GPS hoặc private messages. Last login không có nguồn dữ liệu đáng tin nên bị bỏ qua.

Các metric: total = toàn bộ users (gồm reserved seed); active = status ACTIVE;
inactive = INACTIVE; blocked = LOCKED; newUsers7Days = created_at >= now−7 ngày;
online = distinct ACTIVE accounts có realtime connection trên Backend instance
hiện tại. Không đồng nghĩa token còn hạn, DAU/MAU hoặc vị trí truy cập.

## Suspension/reactivation và audit

Reason bắt buộc1–500 ký tự sau strip. Admin không block chính mình hoặc bất kỳ
ADMIN/SUPER_ADMIN nào qua moderation API; đây là bảo vệ mạnh hơn last-Admin check.
Role thay đổi qua operator. Mỗi mutation khóa các privileged rows theo ID rồi
target user, kiểm tra quyền actor lại trong transaction. Two identical moderation
requests: một đạt, request còn lại409; lock/optimistic conflicts cũng trả409.
Không xóa user, password, providers, friends, messages, groups hoặc notifications.

LOCKED chặn login password/Google/Facebook, JWT cũ bị loại qua status/authVersion.
Unblock giữ nguyên ID/data; tăng version tiếp để JWT cũ không sống lại. User đã
self-deactivate trước khi block trở về INACTIVE, cần explicit self-reactivation;
không tự kích hoạt thay họ. Tên alias `/reactivate` nghĩa gỡ suspension này.

Suspension API publish AccessChanged AFTER_COMMIT: đóng sockets trên instance
hiện tại ngay sau commit. CONNECT/SEND/SUBSCRIBE còn kiểm tra trạng thái/version
hiện tại theo cơ chế đã có; không thêm một lớp DB lookup per-message khác.
Operator chạy riêng không có registry của tiến trình Web; version change vẫn
chặn REST và thao tác STOMP tiếp theo. Nếu cần chấm dứt ngay cả idle socket của
Admin bị compromise, revoke rồi suspend user đã demote qua Web/API, hoặc graceful
restart Backend. Multi-instance proactive socket closure cần event bus/shared
registry trước khi scale; không tuyên bố đã hỗ trợ distributed revocation.

Audit dùng bảng account_actions hiện có, append-only qua APIs: actor_id,user_id,
action,reason,created_at,previous_status,new_status,previous_role,new_role. Dòng cũ
giữ nguyên, before/after cũ có thểNULL; không backfill giá trị suy đoán. Actor0
đại diện deployment operator (không giả một GeoChat user); viewer hiển thị tên này.
Mutation và audit cùng transaction; rollback không để thay đổi thiếu audit. Không
lưu password/token/header. API không sửa/xóa audit; DBA vẫn là trust boundary.
Không thêm lưu raw requests của failed attempts;401/403/409 an toàn trả về client.

## Provision/revoke Admin — operator có chủ đích

Đăng ký user thường bằng cách hiện có, xác minh chính xác internal user ID từ
profile/DB qua operator. User phải tồn tại và ACTIVE để grant; không chọn email
domain, Facebook/Google identity hoặc user đầu tiên một cách tự động.

Entry point riêng `com.geochat.operator.AdminOperatorMain` chạy non-Web, chỉ scan
user persistence và provisioning service; không mở HTTP server/controllers.
Flag `ADMIN_OPERATOR_ENABLED` không tự thực thi grant ở ứng dụng Web thông thường.
Mỗi lần chạy cần action, đúng ID, confirmation dạng `ACTION:ID`, và reason.
Grant/revoke idempotent: lặp đúng trạng thái không tạo thêm audit giả. Hàng Admin
khóa cùng thứ tự với moderation; hai revoke đồng thời không xóa Admin ACTIVE cuối.
Grant/revoke tăng auth_version/row_version, user phải đăng nhập lại; provider links
không bị đổi. Không dùng ad-hoc SQL UPDATE role để bỏ qua các safeguards.

Ví dụ PowerShell (thay123 bằng ID đã kiểm tra; không dùng credentials ví dụ):

```powershell
# Từ root. Cấu hình DB_* process environment theo deployment hiện có.
cd backend
.\mvnw.cmd package
cd ..
$env:SPRING_PROFILES_ACTIVE = 'prod'
$env:ADMIN_OPERATOR_ENABLED = 'true'
$env:ADMIN_OPERATOR_USER_ID = '123'
$env:ADMIN_OPERATOR_ACTION = 'GRANT_ADMIN'
$env:ADMIN_OPERATOR_CONFIRMATION = 'GRANT_ADMIN:123'
$env:ADMIN_OPERATOR_REASON = 'Approved initial administrator'
java '-Dloader.main=com.geochat.operator.AdminOperatorMain' `
  -cp backend/target/backend-0.0.1-SNAPSHOT.jar `
  org.springframework.boot.loader.launch.PropertiesLauncher
if ($LASTEXITCODE -ne 0) { throw 'Provisioning failed; inspect the safe error and audit state.' }
Remove-Item Env:ADMIN_OPERATOR_ENABLED,Env:ADMIN_OPERATOR_USER_ID,Env:ADMIN_OPERATOR_ACTION,Env:ADMIN_OPERATOR_CONFIRMATION,Env:ADMIN_OPERATOR_REASON
```

Revoke: dùng `REVOKE_ADMIN` và confirmation `REVOKE_ADMIN:123`. Trước revoke Admin
cuối, grant cho một existing ACTIVE user đáng tin khác; command từ chối nếu không
còn active Admin. User revoked nhận401 với JWT cũ và403 nếu đăng nhập lại thành USER.
Để recover test user bị suspend: sign in Admin khác, mở detail, unblock với reason;
không reset password/providers. Tuyệt đối không suspend tài khoản thật khi test.

Docker operator chạy cùng image/DB đang vận hành, không mở thêm port:

```powershell
docker compose run --rm --no-deps --entrypoint java `
  -e ADMIN_OPERATOR_ENABLED=true -e ADMIN_OPERATOR_USER_ID=123 `
  -e ADMIN_OPERATOR_ACTION=GRANT_ADMIN -e ADMIN_OPERATOR_CONFIRMATION=GRANT_ADMIN:123 `
  -e 'ADMIN_OPERATOR_REASON=Approved initial administrator' `
  backend -Dloader.main=com.geochat.operator.AdminOperatorMain `
  -cp /app/app.jar org.springframework.boot.loader.launch.PropertiesLauncher
```

Bootstrap Super Admin từ seedV21 vẫn là lựa chọn tương thích, explicit operator
flag/credentials như [hướng dẫn trước](admin-and-password-recovery.md). Nay ghi
GRANT_SUPER_ADMIN actor0; vẫn không reset/reopen account đã cấu hình. Sau bootstrap
tắt flag và gỡ password khỏi environment. Không commit Admin credentials.

Đã map ADMIN_OPERATOR_ENABLED/USER_ID/ACTION/CONFIRMATION/REASON vào Spring,
Compose, .env.example và thêm default disabled/trống vào .env local. Root `.env`
chỉ được Compose load; IDE/Java trực tiếp cần process env. Không ghi secret mới.

## Web và giới hạn

Routes `/admin`, `/admin/users`, `/admin/users/:userId`, `/admin/audit-logs`; giữ
redirect `/app/admin/users`. Layout cũ mở rộng Audit Logs, link Appearance về
Settings, identity và logout có sẵn. Theme dùng CSS/theme runtime hiện tại.
User table có email/status/registered date/actions; server search và filters,
pagination, empty/error/retry/loading. AbortController chống stale responses khi
đổi page/filter. Detail hiển thị providers và recent account history; dialog ghi
username, reason, effect, Confirm/Cancel, trap/restore focus và chặn double submit.
Audit hiển thị table đọc được, không raw JSON, lọc action/actor/target/date.
Labels mới Anh/Việt; table cuộn ngang ở màn hình hẹp. Browser visual smoke chưa
được thực hiện; không coi JSDOM tests là xác nhận tablet/mobile/light/dark thực tế.
Không thay native Mobile hoặc yêu cầu device/emulator build.

## Migration và verification

V23 chỉ thêm before/after fields cho audit và indexes theo query patterns (audit
time/actor/action; users role/status/date). Không sửa V20–V22, reset DB, xóa users
hoặc Docker volumes. H2 migration test giữ audit rows cũ; PostgreSQL counterpart
chạy trong schema transaction riêng khi GEOCHAT_VALIDATE_POSTGRES=true (CI hiện có).

Kết quả kiểm tra cuối sẽ được cập nhật sau lượt Maven/Web cuối cùng.

Docker daemon hiện không tồn tại tại Docker Desktop Linux pipe: **BLOCKED**;
Compose config có thể kiểm tra offline và đã đạt. Không tự start/reset dịch vụ
hoặc dữ liệu ứng dụng. Docker build/Flyway live/Admin smoke với hai disposable
accounts cần chạy lại khi daemon sẵn sàng; không được ghi là đã đạt từ kết quả044.

Giữ gates042: fresh container security scan, GitHub CI đúng SHA, release-stack UI
smoke và backup dữ liệu thật. Không tuyên bố production-ready. Milestone kế tiếp
là xác minh Docker/Admin smoke còn thiếu rồi cân nhắc geographic analytics047;
SMS OTP045 vẫn deferred, không có thay đổi tracking hoặc private-chat reading.

## Files và báo cáo phạm vi

Files mới: AdminOperatorMain, AdminProvisioning, AdminQueries, AdminAuditController,
AccountStateConflict; V23; AdminFoundationIntegrationTest/AdminAuditMigrationTest;
AdminAuditPage/AdminAuditTable/AdminUserDetail/AdminDecision/AdminFoundation.test.tsx;
tài liệu này. Files mở rộng: AdminUsersController/AdminOverviewController,
AccountLifecycleService/SuperAdminBootstrap/UserRepository/AccountAction,
GlobalExceptionHandler, pom.xml/application.yml; Web App/AdminLayout/AdminDashboard/
AdminUsersPage/api accounts+admin/i18n/styles và tests tương ứng; .env.example,
docker-compose.yml, README và business rules. Mobile source không đổi.
