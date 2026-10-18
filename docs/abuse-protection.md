# Chống thao tác tự động và gửi quá nhanh

## Cơ chế hiện có sau cập nhật

Mọi giới hạn dưới đây được kiểm tra ở Backend. Khóa nút Web chỉ giảm thao tác
trùng; không được dùng làm ranh giới bảo mật. Không đổi schema hoặc JWT contract.

| Đường đi | Giới hạn |
|---|---|
| Password login theo IP | 3 request/giây và 10/phút |
| Password login theo IP + username chuẩn hóa | 5/phút |
| Password login theo username, qua mọi IP | 30/5 phút |
| Password registration theo IP | 1/10 giây và 5/giờ |
| Google auth POST theo IP | 10/phút như trước; bearer không đổi bucket thành user |
| Text/image send, mọi conversation của một user | Chung 5/giây và 120/phút cho REST, STOMP và upload image |

Giới hạn mới theo giây và theo tài khoản dùng rolling window: đổi sang giây kế
tiếp không cấp lại ngay toàn bộ quota. Check/update atomic, tính cả attempts,
không hoàn lại lượt khi transaction DB rollback; tin bị chặn không được ghi DB.
HTTP trả429, JSON chung và Retry-After (giây). Web giữ draft theo xử lý lỗi sẵn có.
Giới hạn STOMP subscribe/typing/frame hiện có vẫn giữ để bảo vệ transport.
HTTP gửi text/ảnh còn có ingress guard10/giây và120/phút trước parse body/multipart,
để upload đã quá quota không tiếp tục tiêu tốn xử lý file; quota5/giây chung vẫn
được kiểm tra tại service, không trừ hai lần vào cùng bộ đếm.
Đổi JWT hoặc đổi conversation không tạo lại quota gửi tin của cùng username.

Username được trim/lowercase và hash trước khi lưu trong login guard; không lưu
mật khẩu/token. Giới hạn theo account áp dụng cả username không tồn tại lẫn login
thành công/thất bại, tránh khác biệt tiết lộ account. Không khóa user trong DB.
Tradeoff: người cố ý nhắm một username có thể làm tài khoản đó phải chờ tối đa
cửa sổ5 phút; requests đã bị từ chối không kéo dài thời gian chờ. Đây không phải
hệ thống chống credential stuffing phân tán hoàn chỉnh.

## IP qua proxy tin cậy

Backend mặc định `TRUSTED_PROXY_HOSTS=` (không tin proxy), và
`server.forward-headers-strategy=none` để socket peer không bị rewrite trước guard.
Không được tự bật native/framework forwarded processing khi chưa xem lại guard.

Compose đặt `TRUSTED_PROXY_HOSTS=web`: resolve Docker DNS của đúng service Web,
không tin mọi IP private hoặc cả subnet. Backend chỉ nhận một IP literal trong
`X-Real-IP` khi socket peer khớp địa chỉ proxy đã allowlist; lỗi DNS fail closed
về socket IP. Bỏ qua header X-Forwarded-For do browser gửi. Header malformed,
hostname, chain hoặc port cũng bị bỏ qua.

Nginx `/api/` hiện **ghi đè** `X-Real-IP $remote_addr`; không chuyển nguyên giá trị
do client tự khai báo. Hai client qua cùng Nginx có bucket riêng. Backend Compose
không publish public port. Không cho container không tin cậy dùng service name
`web` hoặc truy cập mạng nội bộ này. DNS cache JVM có thể làm IP cũ còn được tin
trong thời gian ngắn sau khi recreate proxy; cần vận hành mạng nội bộ tin cậy.

Chạy Backend trực tiếp sau reverse proxy khác: cấu hình danh sách IP/hostname
proxy chính xác, phân tách bằng dấu phẩy. Không dùng wildcard/CIDR/broad private
network; proxy phải ghi đè X-Real-IP và chặn đường truy cập Backend ngoài dự kiến.
Nếu sau này thêm CDN/LB phía trước Nginx, phải cấu hình trusted real IP ngay tại
Nginx cho các peer upstream cụ thể; hiện chưa tự tin CF-Connecting-IP/XFF.

## CAPTCHA đăng ký — tùy chọn, bắt buộc khi đã bật

Tích hợp Cloudflare Turnstile cho password registration. Không gọi dịch vụ ngoài
khi chưa bật. Google flow giữ xác minh OIDC hiện có, không thêm CAPTCHA lên callback.

1. Tạo Turnstile widget trong Cloudflare và allowlist hostname Web sử dụng.
2. Đặt environment Backend (Compose đọc `.env` gitignored):

   ```dotenv
   REGISTRATION_BOT_CHECK_ENABLED=true
   TURNSTILE_SITE_KEY=<public-site-key>
   TURNSTILE_SECRET=<private-secret>
   TURNSTILE_HOSTNAMES=localhost,app.your-domain.test
   ```

3. Recreate/restart Backend với config mới. Không đặt secret trong VITE_ variables.
   Public config GET `/api/v1/auth/registration-config` chỉ trả enabled/siteKey.
4. Web tải widget khi enabled; token được gửi trong field tùy chọn `botToken` của
   request register. Backend gọi HTTPS Siteverify, kiểm tra success, action
   `register` và hostname trong allowlist trước khi tạo user/BCrypt. Token thiếu,
   sai, hết hạn, tái sử dụng hoặc provider lỗi đều bị từ chối; không fail open.
   Connect timeout2 giây/read timeout3 giây; không echo provider body/secret/token.
5. Token được xóa/refresh sau register failure; widget expiry/error vô hiệu hóa
   nút đăng ký đến khi có token mới. Nếu config/script không tải được, có Retry.

Enabled thiếu keys/hostnames hoặc dùng placeholder/test bypass keys sẽ fail startup.
Secret được giữ Backend; site key là công khai. Xem quy tắc token one-time và
server validation tại [Cloudflare Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

**Hiện mặc định CAPTCHA chưa bật** vì chưa cấu hình credentials thật. Rate limits
vẫn hoạt động. Không coi CAPTCHA hoặc rate limit là đảm bảo không còn bot/DDoS.
Không tự thay `.env` người dùng hoặc tạo tài khoản dịch vụ bên ngoài.

Mobile source không đổi/build/test. Khi CAPTCHA disabled, JSON register cũ vẫn
được chấp nhận. Khi operator bật CAPTCHA, mọi client dùng password registration
phải gửi token, gồm cả Mobile cũ; Mobile registration cũ sẽ bị từ chối, không có
header/User-Agent miễn trừ có thể bị giả mạo. Cần cân nhắc trước khi bật ở môi
trường có Mobile cũ. Password login/JWT hiện có vẫn giữ nguyên contract.

## Giới hạn vận hành và kiểm chứng

State nằm trong RAM, bounded20.000 keys mỗi store, cleanup entries hết hạn;
restart xóa counts. Một Backend instance: chưa có shared limiter đa instance,
không tự thêm Redis. Chưa thêm global edge WAF, email verification hay giới hạn
số kết nối WebSocket; những mục đó cần milestone riêng. Không stress test dịch
vụ thật hoặc xóa dữ liệu/volume để kiểm chứng.

Tests mới bao phủ proxy spoofing, bucket IP tách biệt, bearer không né auth limit,
rolling-window expiry, concurrent burst, account/IP rotation, REST/STOMP/image
dùng chung quota và không persist khi bị chặn; bot provider được mock, kiểm tra
action/hostname/replay/missing token/config/provider failure; Web widget lifecycle.

Live Turnstile với keys/domain thật: **NOT VERIFIED**. Physical-device checks
SKIPPED vì không có thiết bị; Mobile không nằm trong validation.

## Google local và điều hướng

Google login hoàn tất → `/app/home`; link có chủ đích từ Settings → `/app/settings`.
Vite dev proxy `/api` và `/ws` tới Backend8080 cho phép callback local qua5173.
Npm scripts chọn rõ `vite.config.ts`, tránh file `vite.config.js` được emit từ lần
build trước che cấu hình TypeScript mới. Giữ Authorized redirect URI trong Google
Cloud khớp đúng GOOGLE_REDIRECT_URI; không redirect trực tiếp từ Google tới Home
vì Backend phải xác minh callback và hoàn tất GeoChat session trước.

Theo lựa chọn của chủ dự án, credentials đã chuyển khỏi defaults trong source
sang `backend/config/google-local.properties` được `.gitignore` bảo vệ. Spring
optional import hỗ trợ chạy từ root hoặc `backend`; environment vẫn override được.
Không gửi file local qua chat hoặc commit nó; cần thay Google secret đã từng đặt
trong source. Agent không tự thay secret trong Google Cloud. Docker tiếp tục dùng
environment, không COPY file local này vào image. Test Google có cấu hình riêng
với provider giả, không phụ thuộc Google origin/credentials local.

## Kết quả validation local

- Backend full suite: 152 tests, 0 failures/errors; 4 PostgreSQL tests skipped
  trong lượt này (không có thay đổi schema). Các test bảo vệ mới chạy với guard
  enabled và provider mock, không dựa vào live CAPTCHA/Google.
- Final Backend targeted suite: 28/28 PASS, 0 skipped, sau cập nhật import local,
  cấu hình Google test độc lập và test chặn upload trước parse body. Full suite152
  ở trên chạy trước khi thêm một test ingress cuối; test mới nằm trong28 tests này.
- Final Web full suite: 184/184 PASS; TypeScript/production build PASS, output
  riêng `artifacts/abuse-hardening/web-dist-final` do Windows khóa dist/assets cũ.
  Các API Google trong App tests đều mock, không gọi Backend/tài khoản local thật.
- Compose config PASS. Proxy Vite local5173 `/api/health` trả200 application/json;
  callback không state trả302 về `/oauth/complete`, không SPA fallback. Không dùng
  credentials hoặc cookie của người dùng trong smoke check này.
- Có lỗi thiếu memory/pagefile trong lần thử đầu; đã chuyển sang chạy tuần tự,
  bounded heaps. Không dừng Backend/DB hoặc reset Docker để lấy tài nguyên.
- Live Google consent và live Turnstile chưa được thực hiện. Không coi local
  test/build là GitHub CI hoặc fresh security scan; giữ release gate của042.

Logs và harness nằm trong `artifacts/abuse-hardening` (gitignored). Source đã sửa
cần rebuild/restart Backend để áp dụng guard vào server đang chạy; Vite dev client
đã khởi động lại riêng với config TypeScript. Không restart DB thật hoặc xóa volume.
