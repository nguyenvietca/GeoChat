# PROMPT_044 — Facebook Login và liên kết tài khoản

Ngày thực hiện: 2026-10-19. Không tuyên bố production-ready hoặc Facebook live đã đạt.

## Audit trước triển khai

| Hạng mục | Phân loại | Kết quả |
|---|---|---|
| Password/BCrypt, JWT, account status/authVersion, REST/STOMP | ALREADY IMPLEMENTED | Giữ nguyên cơ chế phiên, quyền và user ID |
| Google OAuth/OIDC, state browser-bound, cookie HttpOnly, ticket một lần | REUSABLE | Mở rộng các lớp hiện có trong `auth/google`, giữ tên để tránh refactor rộng |
| Identity repository, transaction, lock user, unique constraints | REUSABLE | Dùng chung `user_auth_identities` |
| Provider check và provider_email NOT NULL | NEEDS EXTENSION | Migration V22 cho FACEBOOK và email tùy chọn |
| Facebook registration, token debugging, profile retrieval | MISSING | Thêm FacebookSettings/FacebookUserService |
| User email | ALREADY IMPLEMENTED | Nullable; không cần onboarding email hoặc thay đổi schema users |
| Link/unlink Google yêu cầu password | NEEDS EXTENSION | Thêm OAuth proof của provider đang nối cho user không có password |
| Login/register, completion page, AuthContext, API error, settings | REUSABLE | Mở rộng trên UX hiện có, thêm bản dịch Anh/Việt |
| Rate limit và exception handling | REUSABLE | Facebook dùng bucket OAuth hiện có, thông báo provider an toàn |
| Compose/Nginx/Vite/CI | NEEDS EXTENSION | Thêm env và callback không ghi access/error log; jobs hiện có tự chạy tests mới |
| Meta credentials, app audience/permissions, live consent | BLOCKED BY EXTERNAL CONFIGURATION | Không tự thu thập secret hoặc đăng nhập tài khoản thật |

## Luồng triển khai

Spring Security OAuth2 Client thực hiện authorization code flow ở Backend, dùng
confidential client và secret POST. Scope chỉ `public_profile,email`; không dùng
Facebook ID token, JS SDK hoặc token exchange trong browser. Google vẫn OIDC và
PKCE S256. Với Facebook manual flow này không gửi PKCE khi chưa xác nhận hỗ trợ;
loại cả mặc định PKCE của Spring Security 7.1 khỏi registration Facebook.

FacebookUserService gọi Graph `/debug_token` bằng app access token ở Authorization
header, kiểm tra is_valid, app_id, type USER, user_id, expires_at, quyền
public_profile và data_access_expires_at khi có. Sau đó `/me?fields=id,name,email`
được gọi bằng provider bearer, bắt buộc ID khớp token debug. Lỗi HTTP/parse được
thay bằng thông báo cố định, không trả URL/token/secret. Không lưu authorized
client, access token, refresh token hoặc HTTP security session. Các logger HTTP
nhạy cảm được giới hạn WARN; không bật DEBUG/TRACE OAuth/HTTP payload khi dùng
credentials thật, kể cả trong file local import.

Identity key `(FACEBOOK, app-scoped ID)`; email/name chỉ metadata. User mới có
username ngẫu nhiên, password_login_enabled=false và hash ngẫu nhiên không dùng
để đăng nhập. Facebook email **không** được ghi vào users.email làm địa chỉ phục
hồi mật khẩu. Vì users.email nullable, thiếu email vẫn đăng ký/đăng nhập được.
Nếu Facebook email trùng email/username GeoChat hiện có, dừng tạo user và hướng
dẫn đăng nhập cách cũ rồi nối trong Settings; không auto-link/merge. Returning
identity luôn dùng user ID cũ, kể cả email đổi hoặc mất. LOCKED bị từ chối;
INACTIVE giữ luồng phiên hạn chế và explicit reactivation hiện có.

User và identity được tạo trong một transaction; unique provider+subject và
user+provider chặn duplicates. Khi race vi phạm unique, rollback cả user trước
khi resolve identity thắng cuộc; không để orphan. Không chuyển identity giữa user.

State TTL 5 phút, ticket TTL 30 giây, consume một lần, cookie browser-bound;
store giới hạn 1000 flow dùng chung hai provider. Giữ tên cookie Google cũ để
tương thích; cookie HTTPS dựa Web origin, kể cả khi Google tắt. Link lưu user ID
và SHA-256 của đúng JWT gốc; completion kiểm tra JWT còn hạn, user ACTIVE và
authVersion. Origin của cookie POST phải khớp chính xác Web origin. Callback
không có JWT/ticket/provider token trong URL. Logout hủy cookie/flow dùng chung.

Có password: link/unlink yêu cầu nhập lại BCrypt password. Không có password:
Settings chuyển đến `/reauth` của provider đã nối, xác minh đúng identity của
user đang có JWT; chỉ sau proof mới bắt đầu flow LINK provider kia. Với unlink,
proof của provider **còn lại** mới cho phép xóa target. User lock và kiểm tra
phương thức còn lại bảo vệ hai unlink đồng thời. Provider còn lại phải bật và
đã nối; không gỡ phương thức cuối. Không xóa profile/chat/friends/groups/Nearby.

## API và Web

Prefix mới `/api/v1/auth/facebook` có `GET config`, `POST start`, `POST link`,
`POST complete`, `POST cancel`, `GET connections`, `POST unlink`, `POST reauth`.
Google giữ endpoints/response fields cũ; bổ sung fields không phá API.
`POST /{provider}/reauth` nhận `{ "action": "link" | "unlink" }`, không nhận
user ID hoặc target tùy ý. Target luôn là provider còn lại. `complete.nextUrl`
chỉ dùng để chuyển sang bước OAuth thứ hai; Web allowlist đúng hai authorization
paths. `connections` không lộ provider ID/token. Facebook dùng field
`facebookConnected`; Google giữ `googleConnected` và `email`.

Login/Register thêm Continue with Facebook, ẩn khi config disabled/lỗi.
Connected Accounts hiển thị trạng thái, email metadata nếu có, nhập lại password
hoặc xác minh provider, loading/error/success và chặn phương thức cuối. Dùng nút
HTML, label gắn input, SVG aria-hidden, visible focus, layout sẵn có và bản dịch
Anh/Việt. Completion dùng `/oauth/complete?provider=facebook` rồi xóa query;
provider query chỉ chọn completion endpoint, không có quyền xác định identity.

## Environment và local

Đã thêm vào `.env.example`, `.env` local nếu tồn tại, application.yml và Compose:

| Biến | Giá trị mặc định |
|---|---|
| FACEBOOK_LOGIN_ENABLED | false |
| FACEBOOK_APP_ID | trống |
| FACEBOOK_APP_SECRET | trống; chỉ Backend |
| FACEBOOK_REDIRECT_URI | http://localhost:8081/api/login/oauth2/code/facebook |
| FACEBOOK_GRAPH_VERSION | v25.0 |
| GOOGLE_WEB_ORIGIN | Web origin dùng chung, mặc định http://localhost:8081 |

Không có VITE_ secret. Khi disabled, startup không cần Meta credentials và
password/Google tiếp tục hoạt động. Khi enabled mà thiếu hoặc sai cấu hình,
startup fail với thông báo không chứa secret. App ID/Secret đúng định dạng vẫn
cần live test mới biết provider chấp nhận. Spring chạy từ IDE không tự đọc root
`.env`: đưa các biến vào process/run configuration; Compose tự đọc root `.env`.

Compose: Web `http://localhost:8081`, Backend nội bộ `backend:8080`, callback
`http://localhost:8081/api/login/oauth2/code/facebook`. Vite: Web
`http://localhost:5173`, proxy `/api` tới Backend `http://localhost:8080`;
khuyến nghị callback `http://localhost:5173/api/login/oauth2/code/facebook`,
GOOGLE_WEB_ORIGIN=http://localhost:5173 và VITE_API_BASE_URL trống để cùng origin.
Cũng hỗ trợ callback8080 trên loopback khi đăng ký và cấu hình đúng URI đó.
Không trộn localhost với127.0.0.1. Production phải cùng Web origin HTTPS.

Nginx proxy callback Facebook qua `/api`, tắt access/error logging của callback
và dùng no-referrer giống Google. Forward Host và X-Forwarded-Proto như cũ;
Spring forward-headers-strategy=none, callback/origin lấy từ cấu hình allowlist,
không suy ra từ X-Forwarded-Host/Port. Do đó không cần mở public Backend port
hoặc tin forwarded headers để dựng redirect URI. TLS proxy ngoài phải cấu hình
HTTPS public origin/callback đúng. Routing thực tế qua container vẫn cần Docker.

## Thiết lập Meta Developer

1. Vào [Meta for Developers](https://developers.facebook.com/apps/), tạo/chọn app
   và use case Facebook Login dành cho đăng nhập người dùng Web. Không chọn sản
   phẩm Business Login thay thế mà chưa điều chỉnh protocol/requirements.
2. Trong app settings lấy App ID và App Secret; chỉ lưu secret ở Backend `.env`
   hoặc secret manager. Không gửi lên chat, Vite, commit hoặc ảnh chụp.
3. Cấu hình website URL/app domains tương ứng hostname thực, contact, privacy
   policy và data deletion instructions theo yêu cầu dashboard của app.
4. Bật Web OAuth/authorization code nếu dashboard yêu cầu; nhập callback chính
   xác trong valid OAuth redirect URIs/redirect validator. Giữ strict redirect
   matching. Tên mục console có thể thay đổi; kiểm tra tài liệu chính thức dưới.
5. Chỉ yêu cầu public_profile/email. Thêm admin/developer/tester hoặc permitted
   test audience theo dashboard, chấp nhận invitation khi cần. Email có thể
   không được cấp hoặc không trả về; không coi đây là lỗi xác thực identity.
6. Development localhost HTTP chỉ dùng nếu cấu hình Meta hiện tại cho phép. Nếu
   redirect validator từ chối, dùng hostname HTTPS development được phép và
   cập nhật đồng bộ Web origin/callback/CORS. Không bỏ state/CSRF/strict checks.
7. Bật env, restart Backend, thử login/cancel, returning ID, email collision,
   thiếu email, link từ password/Google, unlink và REST/STOMP theo scenarios A–I
   trong prompt. Chỉ ghi kết quả khi thực hiện thực tế, không chụp token.
8. Trước khi mở audience ngoài roles/test users, hoàn tất các yêu cầu dashboard
   áp dụng cho app: public policies/data deletion, mode/audience, permission
   access review và business verification nếu Meta yêu cầu. Không mặc định rằng
   bật Live một lần là đủ cho mọi app/use case.

Tham khảo chính thức:
[Manual flow](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/),
[Token debugging](https://developers.facebook.com/docs/graph-api/reference/debug_token/),
[Versioning](https://developers.facebook.com/docs/graph-api/guides/versioning/),
[Spring OAuth2 Login](https://docs.spring.io/spring-security/reference/servlet/oauth2/login/advanced.html).
Trong phiên thực hiện, các trang Meta trả429/cache miss; chưa xác nhận trực tiếp
UI console, support timeline v25.0 hoặc localhost policy hiện tại. v25.0 là pin
cấu hình cần đối chiếu dashboard/changelog trước live. Khi nâng version: kiểm tra
lịch hết hỗ trợ và thay đổi Login/debug_token/me, đổi FACEBOOK_GRAPH_VERSION ở
`.env`, chạy automated tests, rồi chạy A–I bằng permitted test app trước rollout.

## Dữ liệu, tương thích và giới hạn

V22 chỉ mở provider check và nullable provider_email, giữ V19/V20/V21 và tất cả
unique/FK/user data. Không reset PostgreSQL/volume. Backup trước rollout migration.
Không dùng email Facebook cho password reset, không thêm password onboarding.
JWT claims/expiry, REST/WebSocket contracts và native Mobile giữ nguyên.

State vẫn trong memory một Backend instance: restart hủy flow đang chờ;
multi-instance cần sticky routing/shared state trước scale. Provider bị tắt có
thể làm user chỉ có provider đó không đăng nhập được; đánh giá trước khi tắt.
Không coi H2 test là bằng chứng migration PostgreSQL thật đã đạt.

## Validation và trạng thái

| Kiểm tra | Kết quả cuối |
|---|---|
| Backend Linux, toàn bộ JUnit và PostgreSQL integration | VERIFIED BY AUTOMATED TEST — 202 tests, 0 failures, 0 errors, 0 skipped |
| Backend password/Google/Facebook/state/session subset trên Windows | VERIFIED LOCALLY — 61/61 trước thay đổi cách ly H2 |
| Web Vitest | VERIFIED BY AUTOMATED TEST — 224/224, 26 files |
| TypeScript + production Vite build | VERIFIED LOCALLY — PASS trên host và Docker Node22 |
| Web lint | NOT APPLICABLE — package.json chưa cấu hình lint script |
| Docker Backend/Web build | VERIFIED LOCALLY — cả hai image build thành công |
| Compose environment mapping | VERIFIED LOCALLY — config --quiet exit0 |
| Nginx/HTTP smoke | VERIFIED LOCALLY — 14/14 mục, gồm Google/Facebook cancellation, wrong state/Origin, no callback code logging, password/JWT và SPA return |
| PostgreSQL16/PostGIS schema | VERIFIED LOCALLY — Flyway V22 success, provider check GOOGLE/FACEBOOK, provider_email nullable |
| DB identity constraints | VERIFIED BY AUTOMATED TEST — V19→V22, coexistence, duplicate subject/provider, FK và password/user preservation |
| REST/STOMP/friends/groups/Nearby regressions | VERIFIED BY AUTOMATED TEST — trong bộ202, gồm18 WebSocket cases |

Lần chạy Linux đầu: 202 tests với11 errors ở LocationIntegrationTest vì H2 schema
dùng chung bị context khác drop. Đã sửa test profile dùng database UUID riêng
cho mỗi context và chạy lại **toàn bộ**: 202/202, không bỏ qua test lỗi. Thay đổi
này chỉ áp dụng profile test, không thay database ứng dụng/PostgreSQL production.

Evidence local (gitignored): `artifacts/prompt044-linux-final-tests.log`,
`prompt044-web-final-tests.log`, `prompt044-final-http-smoke.log`,
`prompt044-backend-final-build.log`, `prompt044-web-build.log`,
`prompt044-final-stack.log`, `prompt044-cleanup.log`. Cache Maven/bản build tạm
trong backend/artifacts đã dọn; không commit dependency cache hoặc credentials.

Live Facebook Login: **NOT VERIFIED — chưa đăng nhập Facebook thật**.
Google live trong phiên này: NOT VERIFIED; không thay kết quả user-accepted của043.
UI viewport320/768/desktop, keyboard thực tế và light/dark: cần smoke browser;
physical-device checks: SKIPPED vì không có thiết bị thật. Không chạy Mobile tests.
GitHub Actions: NOT VERIFIED nếu chưa có runner result cho SHA mới.

Giữ các release gates của [PROMPT_042](release-verification-042.md): fresh image
vulnerability scan/DB timestamp, CI runner đúng SHA, smoke UI trên release stack,
backup dữ liệu thật; local code/tests không thay các gate này. Milestone tiếp theo:
cấu hình permitted Meta app, live scenarios A–I và release verification trên stack.

## Files tạo mới

- Backend: `auth/google/FacebookSettings.java`, `FacebookUserService.java`;
  migration `V22__facebook_auth_identities.sql`.
- Backend tests: `FacebookAuthIntegrationTest.java`, `FacebookFlowsTest.java`.
- Web: `api/facebook.ts`, `features/auth/FacebookButton.tsx`,
  `FacebookAuth.test.tsx`, `features/settings/FacebookAccount.tsx`.
- Verification: `scripts/release/compose.facebook-044.yml`,
  `scripts/release/verify-facebook-044.cjs`; tài liệu này.

## Files mở rộng

- Backend: GoogleAccounts, GoogleController, GoogleFlows, GoogleIdentity,
  GoogleOAuthConfig, GoogleSettings; SecurityConfig, AbuseRateLimitFilter;
  application.yml, application-test.yml, .dockerignore. Test profile dùng H2
  name riêng theo Spring context để context đóng không xóa schema context khác.
- Tests: AuthFlowIntegrationTest, GoogleFlowsTest,
  PostgresGoogleIdentityMigrationTest (áp dụng V19 rồi V22 trong schema test
  transaction, kiểm tra coexistence, unique, FK và bảo toàn password/user).
- Web: api/google.ts, LoginPage, RegisterPage, GoogleReturnPage,
  ConnectedAccounts, GoogleAuth.test.tsx, en.ts/vi.ts, styles.css, nginx.conf.
- Root: .env.example, docker-compose.yml, README.md;
  docs/product/business-rules.md. `.env` local chỉ được bổ sung biến trống/disabled,
  không thay credentials đang dùng và không commit.

## Tái lập kiểm tra Docker

Chạy từ root, sau khi Docker daemon sẵn sàng. Các lệnh không dùng `.env` thật,
không publish port và không gắn volume ứng dụng:

```powershell
docker buildx build --load -t geochat-backend:verify-044 backend
docker buildx build --load -t geochat-web:verify-044 apps/web
docker compose -p geochat-v044-tests -f scripts/release/compose.facebook-044.yml up -d --wait
docker compose -p geochat-v044-tests -f scripts/release/compose.facebook-044.yml --profile tests run --build --rm backend-tests
node scripts/release/verify-facebook-044.cjs
docker compose -p geochat-v044-tests -f scripts/release/compose.facebook-044.yml down
```

Trên máy Windows phiên này, Docker Desktop dùng pipe
`npipe:////./pipe/dockerDesktopLinuxEngine`; cần quyền truy cập pipe. Có thể đặt
DOCKER_HOST trong process kiểm thử khi default context không trỏ đúng daemon.
Lệnh Compose chính `docker compose --env-file .env.example config --quiet` cũng
được dùng để kiểm tra mapping environment.

## Báo cáo cuối — 28 mục

1. **Audit:** hoàn tất Backend/Web/identity/security/infra; phân loại ở bảng đầu.
2. **Tái sử dụng043:** state, browser cookie, completion ticket, repository,
   transaction/lock, JWT, controllers, callback page và AuthContext hiện có.
3. **OAuth Facebook:** IMPLEMENTED — server-side confidential authorization code,
   registration riêng trong cùng security chain; không exchange token trên Web.
4. **Xác minh identity:** IMPLEMENTED và automated-tested — debug_token app/type/
   expiry/scopes/ID, `/me` ID khớp; provider token không trả cho browser hoặc DB.
5. **User mới:** tạo user+identity atomic, username/hash ngẫu nhiên,
   password login disabled; identity insert failure rollback user.
6. **Returning user:** dùng ID Facebook app-scoped để lấy cùng user; enforce status.
7. **Thiếu email:** được hỗ trợ vì model nullable; không email giả/onboarding rộng.
8. **Email collision:** không auto-link/merge; hướng dẫn đăng nhập cách cũ rồi nối.
9. **Link:** explicit action, JWT gốc/browser/state/authVersion bound, password
   proof hoặc OAuth proof provider đã nối; không nhận user ID từ browser.
10. **Unlink:** fresh proof, lock user, còn provider bật hoặc usable password;
    không xóa dữ liệu user; hai unlink đồng thời không gỡ cả hai provider.
11. **Google+Facebook:** cùng user ID, unique identities, không transfer identity.
12. **JWT:** giữ claims/expiry/authVersion và REST/STOMP hiện có; ticket một lần.
13. **Web:** Facebook ở Login/Register, connected status/email/actions,
    loading/error/success, Anh/Việt, semantic controls và focus style.
14. **Environment:** .env.example/.env local, Spring và Compose map đủ năm biến
    FACEBOOK; Web origin dùng GOOGLE_WEB_ORIGIN chung; không VITE_ secret.
15. **Meta setup:** có hướng dẫn use case, credentials, redirect/domain,
    permissions, test roles, public audience/review và version upgrade ở trên.
16. **Migration:** V22 additive extension, giữ migration cũ/data/unique/FK;
    đã chạy trên PostgreSQL16/PostGIS test và kiểm tra constraints.
17. **Files mới:** liệt kê ở phần Files tạo mới, gồm implementation/tests/docs và
    Compose/HTTP verification scripts.
18. **Files sửa:** liệt kê ở phần Files mở rộng; không refactor ngoài auth/Web.
19. **Backend:** 202/202 Linux tests PASS, 0 skipped; subset Windows61/61 PASS.
20. **Web:** 224/224 PASS; tsc/Vite production PASS; lint chưa cấu hình. Còn
    warning bundle >500KB, không phải build failure hoặc security blocker.
21. **Docker:** Backend/Web build PASS, stack healthy, Compose PASS, HTTP14/14
    PASS; stack dùng một lần đã dọn, không chạy/root-deploy stack dữ liệu thật.
22. **Facebook live:** NOT VERIFIED — không thực hiện đăng nhập Facebook thật,
    không có kết quả consent/test account để tuyên bố live thành công.
23. **Google regression:** automated OIDC19 + state4 cases và HTTP redirects/
    cancellation PASS; không thực hiện Google live trong phiên này.
24. **API compatibility:** giữ password/Google và JWT/WebSocket contracts,
    chỉ thêm Facebook endpoints/response fields tương thích.
25. **Mobile:** không sửa native Mobile, không chạy Mobile builds/typechecks/tests;
    physical-device checks SKIPPED vì không có thiết bị thật.
26. **Known gaps:** Meta docs trả429 nên console/local HTTP policy/support pin
    phải đối chiếu trước live; visual browser320/768/desktop/light/dark chưa smoke;
    OAuth memory state vẫn chỉ một instance. Không có Critical/High chưa xử lý
    được xác định trong phạm vi implementation/automated validation này.
27. **PROMPT_042:** fresh image security scan, CI runner đúng SHA, release UI smoke
    và backup dữ liệu thật vẫn là gates; không dùng kết quả044 thay cho chúng.
28. **Milestone tiếp theo:** cấu hình Meta app/test audience thật, chạy A–I,
    xác minh chính sách/version hiện tại, rồi hoàn tất release gates042.

**PROMPT_044 COMPLETE** — triển khai và automated validation trong phạm vi đã đạt;
không có nghĩa Facebook live hoặc production readiness đã được xác minh.
