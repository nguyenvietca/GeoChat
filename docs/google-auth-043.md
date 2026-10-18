# PROMPT_043 — Google Login

## Audit trước triển khai (2026-10-18)

Baseline Git: chỉ AI_promt/prompt_043.md chưa tracked; giữ nguyên file người dùng.

| Yêu cầu | Hiện trạng | Phân loại |
|---|---|---|
| Auth/JWT/BCrypt | AuthController/AuthService/JwtService, token lưu localStorage; WebSocket dùng JWT | ALREADY IMPLEMENTED |
| User/profile | Username bắt buộc; email tùy chọn, unique lowercase; password_hash non-null; ACTIVE/INACTIVE/LOCKED | ALREADY IMPLEMENTED |
| Login/register/settings | AuthContext, ApiError/401, Settings theme/notifications | ALREADY IMPLEMENTED |
| Disabled-user auth | Password service chưa kiểm tra status; cần áp dụng cùng quy tắc cho phương thức mới | NEEDS IMPROVEMENT |
| Google OIDC, identities, linking/unlinking | Chưa có | MISSING |
| OAuth state/completion | Chưa có; API hiện stateless/bearer, CSRF disabled cho bearer | MISSING |
| Infra | /api proxy đủ cho callback; prod JWT/DB/CORS bắt buộc; CI Backend/Web sẵn có | ALREADY IMPLEMENTED |
| Mobile | Loại trừ | NOT APPLICABLE |

## Quyết định bảo mật

Spring Security OAuth2 Client Authorization Code + OIDC: framework xác minh
signature/issuer/audience/time/nonce/state, bắt buộc PKCE S256. Không tự giải mã
Google token từ browser. Scope chỉ openid/email/profile, không offline access.
Temporary store bounded 1000 transactions, TTL5 phút, HTTP-only SameSite=Lax
cookie ràng buộc browser. Authorization request tiêu thụ một lần. Callback chỉ
chuyển claims đã xác minh thành completion ticket cookie ngẫu nhiên TTL30 giây;
không đưa JWT/token/ticket vào URL. JWT chỉ phát qua POST completion response.
Không lưu Google access/refresh tokens hoặc OAuth security context/session.

Link bắt đầu bằng bearer + nhập lại mật khẩu; transaction lưu user ID và hash
của đúng JWT đó. Completion yêu cầu cùng JWT còn hợp lệ, browser cookie và ACTIVE
user. Logout hủy transaction; Web không thể hoàn tất link khi mất phiên. Unlink
yêu cầu nhập lại mật khẩu và password login usable; Google-only không được bỏ
phương thức cuối. Email trùng không tự link/merge. Unique DB constraints là chốt
cuối; user + identity tạo trong cùng transaction, retry sau rollback chống orphan.

Temporary storage chỉ phù hợp một Backend instance; restart làm mất flow đang
chờ, multi-instance cần shared state/sticky routing. Giữ mô hình JWT/logout cũ:
logout không thu hồi mọi bearer đã bị sao chép; không thay kiến trúc JWT ở milestone này.

Google live verification và các blocker release của PROMPT_042 chưa được coi là đạt.

## Cấu hình Google Cloud / chạy local

1. Tạo/chọn Google Cloud project, mở Google Auth Platform (OAuth consent screen).
   Cấu hình branding/audience/contact; nếu External đang Testing, thêm tài khoản
   thử nghiệm vào Test users. Không cần VPS, domain mua hoặc quyền Gmail/Drive.
2. Tạo OAuth client loại **Web application**. Giữ client secret ở Backend.
   Luồng redirect server-side này không dùng Google JS SDK; Authorized JavaScript
   origins không phải điều kiện của luồng đang triển khai.
3. Với Compose mặc định, Authorized redirect URI phải đúng từng ký tự:
   `http://localhost:8081/api/login/oauth2/code/google`.
   Đặt `GOOGLE_ENABLED=true`, client ID/secret thật trong `.env` được git-ignore;
   `GOOGLE_REDIRECT_URI` như trên và `GOOGLE_WEB_ORIGIN=http://localhost:8081`.
   Không thay `.env` đang dùng bằng template; không đưa secret vào VITE_ hoặc chat.
4. Với Vite5173 + Backend8080: đặt environment trong IDE/process Backend,
   `GOOGLE_WEB_ORIGIN=http://localhost:5173`,
   `GOOGLE_REDIRECT_URI=http://localhost:8080/api/login/oauth2/code/google`, và
   đăng ký chính callback8080 này trong Google Cloud. CORS phải gồm origin5173.
   Spring không tự đọc `.env` root khi chạy ngoài Compose. Dùng cùng hostname
   localhost ở mọi bước, không trộn localhost/127.0.0.1 hoặc đổi port giữa flow.
5. Public production: cùng Web origin HTTPS cho callback và completion page;
   HTTP chỉ được chấp nhận cho loopback local. Cookie Secure theo callback scheme.
   Không derive URL từ Host/X-Forwarded-*; URI đã cấu hình là nguồn allowlist.
   Không cần mở public port Backend: Nginx `/api/` phục vụ OAuth và REST như cũ.
6. Khi chưa cấu hình: giữ `GOOGLE_ENABLED=false`; username/password login vẫn chạy,
   Google button ẩn. Khi bật nhưng thiếu/sai định dạng cấu hình, startup fail bằng
   thông báo không chứa secret. Credentials có định dạng hợp lệ nhưng bị Google
   từ chối chỉ có thể xác minh khi thực hiện live flow; không gọi Google lúc startup.

## API và Web UX

- GET `/api/v1/auth/google/config`: trạng thái công khai, không chứa client ID/secret.
- POST `/api/v1/auth/google/start`: tạo login transaction; Origin phải đúng Web origin.
- GET `/api/oauth2/authorization/google`: Spring redirect, chỉ hoạt động với browser
  cookie được tạo từ start/link POST; callback `/api/login/oauth2/code/google`.
- POST `/api/v1/auth/google/link`: bearer + JSON password; proof kiểm tra lại BCrypt.
- POST `/api/v1/auth/google/complete`: browser ticket cookie, Origin; link còn cần
  cùng JWT gốc còn hạn. Login trả JWT GeoChat như cũ; link không thay phiên hiện tại.
- GET `/api/v1/auth/google/connections`: bearer, chỉ thông tin provider/email của mình.
- POST `/api/v1/auth/google/unlink`: bearer + password, phải còn password login usable.
- POST `/api/v1/auth/google/cancel`: browser cookie + Origin, hủy cả callback in-flight.

POST cookie endpoints xác minh exact Origin; link/unlink còn yêu cầu bearer và
nhập lại password. Không nới CSRF cho OAuth SecurityFilterChain; API bearer giữ
kiến trúc cũ. API Google POST có rate limit10/phút, state store bounded1000.
Cookie HttpOnly, host-only, SameSite=Lax; HTTPS dùng __Host- prefix + Secure + Path=/
để chặn sibling-domain cookie tossing, localhost HTTP dùng path=/api. Không có
permanent HTTP session.
Sai mật khẩu xác nhận trả400 để người dùng thử lại, không coi là phiên JWT hết hạn.

Google return page `/oauth/complete` đổi JWT lấy profile qua getCurrentUser trước
khi lưu theo AuthContext hiện có. Return route chỉ home/settings, không external
return URL. Error query chỉ là mã cố định failed/cancelled, được xóa khỏi history.
Callback access/error logs không ghi code; không bật OAuth DEBUG/TRACE trên hệ
thống có tài khoản thật. Không lưu access/refresh token trong identities hoặc session.

## Dữ liệu / rollout

Flyway mới V19, không sửa migration đã áp dụng. Thêm password_login_enabled default
true, giữ nguyên hashes/IDs/data hiện có. Google-only users có flag false và hash
ngẫu nhiên không thể dùng password; không cho unlink phương thức cuối. Chưa có
password-creation/reset flow cho Google-only users; không thêm ngoài scope.
Identity key là (GOOGLE, sub), unique thêm (user_id, provider), FK cascade tới users.
Returning Google thay đổi provider_email metadata, không dùng email làm identity key.

Backup DB trước rollout migration. Rollback image không xóa identities/flag; image
cũ chưa hỗ trợ Google không thể đăng nhập Google-only users. Tắt Google cũng không
tạo password cho các user này: phải cân nhắc họ trước khi tắt provider. Không auto
merge email, không reset password hoặc chuyển quyền sở hữu danh tính giữa users.

## Live verification — NOT VERIFIED

Agent không thực hiện consent với tài khoản Google thật, không thu thập credentials.
Sau khi cấu hình, chạy lần lượt A–F của prompt: Google mới → đăng xuất/đăng nhập
lại cùng user; account password có chat/friend/group → link → Google login vẫn cùng
data; email collision không auto-link; password account unlink vẫn login được;
Google-only không unlink; state/callback replay bị từ chối. Kiểm tra network không
có JWT/ticket trong URL và callback không ghi code vào access logs. Không chụp token.
Kiểm tra keyboard, theme sáng/tối và viewport320/768px bằng browser khi có session.
Không yêu cầu physical device; Mobile không được sửa/build/typecheck/test.

Tài liệu chính thức: [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect),
[Spring OAuth grant/PKCE](https://docs.spring.io/spring-security/reference/servlet/oauth2/client/authorization-grants.html).

## Báo cáo triển khai (27 mục của prompt)

| # | Nội dung | Kết quả / bằng chứng |
|---|---|---|
| 1 | Audit ban đầu | Bảng audit đầu tài liệu; kiểm tra cả auth, user, Web, deployment và CI trước triển khai. |
| 2 | Auth tái sử dụng | BCrypt, JwtService, AuthContext, profile API, ApiError/401, REST/STOMP bearer hiện có. |
| 3 | Kiến trúc Google | Spring OAuth2 Client Authorization Code/OIDC; separate stateless security chain; Google không thay JWT GeoChat. |
| 4 | Identity model | GOOGLE + sub ổn định; provider email là metadata; unique subject và một Google/user; không lưu provider token. |
| 5 | Flyway | V19 additive; users.password_login_enabled default true; bảng identities FK cascade. Không sửa migration cũ. |
| 6 | Google mới | Email verified, không collision: tạo user/default profile + identity cùng transaction, username UUID, password login disabled. |
| 7 | Google quay lại | Lookup subject trước email; cùng user ID, kiểm tra ACTIVE, không ghi đè email nội bộ từ Google. |
| 8 | Link | POST bearer + nhập lại password; state giữ user ID/JWT hash; completion kiểm tra đúng JWT còn hạn. Không chuyển identity giữa users. |
| 9 | Unlink | Nhập lại password usable, lock user, chỉ xóa identity; Google-only bị từ chối; dữ liệu user giữ nguyên. |
| 10 | Collision email | Không auto-merge/link, không JWT cho account cũ; hướng dẫn dùng phương thức hiện có rồi link trong Settings. |
| 11 | State/PKCE | Spring state/nonce + PKCE S256; browser cookie, TTL5 phút, one-time callback; ticket TTL30 giây, one-time redemption. |
| 12 | JWT | Phát JWT bằng service cũ qua response POST; không URL/fragment/state/referrer. Provider token và OAuth cookie không mở quyền API. |
| 13 | Login UX | GoogleButton dùng chung Login/Register; ẩn khi disabled; loading/error/focus/label; giữ form password. |
| 14 | Settings UX | Connected Accounts: trạng thái/email của mình, connect/disconnect bằng password; chặn bỏ phương thức cuối. |
| 15 | Environment | GOOGLE_ENABLED=false mặc định; ID/secret/redirect/web origin phía Backend. Enabled thiếu/sai định dạng fail startup; không thay .env thật. |
| 16 | Google Cloud | Các bước setup và callback chính xác cho Compose8081 hoặc Vite5173/Backend8080 ở trên; consent/Test users; không cần JS SDK. |
| 17 | File tạo mới | Danh sách dưới đây. |
| 18 | File sửa | Danh sách dưới đây. |
| 19 | Backend tests | Compile PASS. Full suite: 143 tests, 0 failures/errors, 4 skipped vì không bật PostgreSQL trong lượt này. Lượt riêng: 24/24 PASS, gồm cả 4 PostgreSQL tests, 0 skipped. HTTP link/unlink regression cuối: 1/1 PASS. |
| 20 | Web tests/build | 20 files, 180/180 PASS; Google UI suite 8/8 PASS; tsc -b và production Vite build PASS. Không có lint script được cấu hình. |
| 21 | Docker | Compose config và cả hai image build PASS; kết quả runtime ghi ở mục Docker bên dưới. |
| 22 | Live Google | **NOT VERIFIED**. Automated provider là HTTP server local với RSA/JWK và signed ID tokens; không dùng tài khoản/credentials Google thật. |
| 23 | API compatibility | Không đổi contract login/register/JWT/profile/STOMP hiện có. Thêm endpoints Google; password login cũng từ chối account không ACTIVE. Regression chat/friends/Nearby/notifications/attachments trong suites hiện có đạt. |
| 24 | Mobile | Không sửa source, không build/typecheck/test. Physical device checks SKIPPED vì không có thiết bị thật. |
| 25 | Security limitations | Single-instance temporary store; restart mất pending flow; bearer logout không global revoke; localStorage JWT theo kiến trúc cũ; chưa có tạo/reset password cho Google-only. Visual keyboard/theme/viewport và live Google vẫn NOT VERIFIED. Không biết issue Critical/High chưa giải quyết trong phần triển khai này; không coi đây là chứng nhận security scan mới. |
| 26 | Blocker PROMPT_042 | Giữ fresh image scan/feed, GitHub runner đúng SHA, smoke UI release và backup DB/ảnh thật trước deployment. Docker hiện hoạt động không tự chứng minh các gate đó đã đạt. |
| 27 | Milestone tiếp theo | Cấu hình Google local bằng credentials của chủ dự án, chạy A–F và visual Web; sau đó hoàn thành các release gate của 042. Chưa mở rộng Mobile/provider khác. |

### File tạo mới

- `backend/src/main/java/com/geochat/auth/google/`: GoogleSettings, GoogleIdentity,
  GoogleIdentityRepository, GoogleAccounts, GoogleFlows, GoogleOAuthConfig, GoogleController.
- `backend/src/main/resources/db/migration/V19__google_auth_identities.sql`.
- `backend/src/test/java/com/geochat/auth/google/`: GoogleAuthIntegrationTest,
  GoogleFlowsTest, PostgresGoogleIdentityMigrationTest.
- `apps/web/src/api/google.ts`, `apps/web/public/google-g.svg`.
- `apps/web/src/features/auth/GoogleButton.tsx`, `GoogleReturnPage.tsx`, `GoogleAuth.test.tsx`.
- `apps/web/src/features/settings/ConnectedAccounts.tsx` và tài liệu này.

`AI_promt/prompt_043.md` là file yêu cầu đã có sẵn của người dùng, không phải file
implementation do agent tạo. Logs/harness kiểm chứng nằm trong `artifacts/prompt043`
(gitignored), không chứa credentials thật.

### File sửa

- Backend: `pom.xml`, SecurityConfig, AuthService, AbuseRateLimitFilter, User,
  UserRepository; `application.yml`, `application-prod.yml`.
- Web: `nginx.conf`, App, api/client, AuthContext, LoginPage, RegisterPage,
  SettingsPage, styles.css.
- Config/docs: `.env.example`, `docker-compose.yml`, README, `docs/deployment.md`.
- Không sửa Mobile, shared contracts, workflows CI hoặc migrations V1–V18.

### Bằng chứng và giới hạn kiểm chứng

Logs: `compile.log`, `backend-tests.log`, `google-postgres-tests.log`,
`http-link-unlink-tests.log`, `web-tests.log`, `web-google-tests.log`,
`web-build.log`, `backend-build.log`, `web-docker-build.log`, `docker-smoke.log`
trong `artifacts/prompt043`.

Integration tests dùng provider giả thực hiện authorization/code exchange với
PKCE + nonce và RSA signature; có issuer/audience/expiry/signature failures,
unverified email, state/browser binding, callback/ticket replay/expiry,
concurrency/rollback, collision, disabled account, JWT đổi/hết hạn/sai user,
logout cancellation, Google-only unlink denial và không provider token leakage.
PostgreSQL tests xác nhận V19/constraints/FK/password preservation trên dữ liệu giả.

Lượt thử runner Linux bằng Compose `--build` gặp host out-of-memory trước khi chạy
tests (`backend-tests-linux.log`): **BLOCKED**, không tính là Linux test PASS.
Host Java21 Maven Wrapper chạy suites nêu trên thành công; migration chạy với
PostGIS Docker riêng. Đã dọn đúng project test, không reset Docker engine.
GitHub Actions hiện có chạy Maven toàn bộ với GEOCHAT_VALIDATE_POSTGRES=true,
Web test/build và container builds, nên bao phủ tests mới sau khi source được
đưa lên runner. **Chưa có kết quả GitHub runner cho thay đổi này**, không push/PR.
Không xóa volume, restore/restart DB thật hoặc thay environment của người dùng.

### Docker — VERIFIED LOCALLY

Ngày 2026-10-18, `verify-recovery.ps1` riêng cho 043 kết thúc **exit 0**,
`docker-smoke.log` ghi cả hai nhóm PASS:

- Google disabled/config không cần credentials; đăng ký/password login hoạt động.
- Callback `/api/login/oauth2/code/google` qua Nginx tới Backend trả401 khi provider
  disabled, không rơi về SPA; Google SVG phục vụ thành công. Luồng enabled/callback
  thật với provider giả được kiểm chứng ở Backend integration tests, không gọi Google.
- `/api` có bearer authentication; `/ws` HTTP upgrade101; invalid JWT401; SPA refresh.
- DB outage trả503 an toàn; restart DB/Web/Backend và dùng lại JWT cũ thành công;
  Backend outage trả502 qua proxy rồi phục hồi.
- Dump/restore DB giả; Flyway checksum, PostGIS, GiST index, dữ liệu liên kết và
  đăng nhập ứng dụng trên bản restore đều đạt. Project riêng
  `geochat-v043-833daba4e4` đã cleanup, không dùng `down -v`.

Images đã kiểm chứng:

| Tag | Immutable image ID |
|---|---|
| geochat-backend:verify-043 | sha256:d5d775ce94c9bc64821b37286069147e286050271f789c27d59c8e882b558c29 |
| geochat-web:verify-043 | sha256:8c679cb7d534703261d589f72e61e92f121835a46dceb4918c6a9d396f466f1c |

Trạng thái cuối: **IMPLEMENTED**, **VERIFIED BY AUTOMATED TEST**, **VERIFIED LOCALLY**
trong phạm vi nêu trên. **VERIFIED WITH LIVE GOOGLE: chưa đạt / NOT VERIFIED**.
Visual smoke, GitHub CI và fresh image scan không được suy diễn từ kết quả local.

PROMPT_043 COMPLETE
