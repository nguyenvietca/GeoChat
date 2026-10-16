# Báo cáo PROMPT 040 — Security Hardening & Production Readiness

Ngày thực hiện: 2026-10-16.

## 1. Audit bảo mật ban đầu

Audit chi tiết nằm tại [prompt040-security-audit.md](prompt040-security-audit.md). Không phát hiện lỗ hổng Critical. Ba vấn đề High đã xác minh là cấu hình production có thể dùng JWT secret mặc định, JWT thô được giữ trong thuộc tính phiên STOMP và thiếu rate limit trên các luồng dễ bị lạm dụng.

## 2. Phân nhóm phát hiện theo mức độ

| Mức độ | Phát hiện | Trạng thái | Bằng chứng và kiểm thử | Rủi ro còn lại |
|---|---|---|---|---|
| High | Production có thể dùng JWT secret mặc định | FIXED | `application-prod.yml` bắt buộc `JWT_SECRET`; backend compile và 120 test đạt | Quy trình triển khai vẫn phải cấp secret đủ mạnh |
| High | JWT thô nằm trong STOMP session và có thể xuất hiện ở DEBUG log | FIXED | Session chỉ giữ username và thời điểm hết hạn; WebSocket integration test đạt và log kiểm tra không còn JWT | Payload có thể xuất hiện nếu quản trị viên tự bật DEBUG ngoài production |
| High | Thiếu rate limit cho authentication, friend request, search và gửi tin | FIXED | `AbuseRateLimitFilterTest` xác minh ngưỡng, 429 JSON và `Retry-After`; realtime guard giới hạn SEND/SUBSCRIBE | Bộ đếm theo từng instance và mất khi restart |
| Medium | Login không có giới hạn chiều dài | FIXED | DTO dùng Bean Validation với username 50, password 128; auth integration đạt | Không có |
| Medium | 401/403 từ Spring Security không luôn theo API envelope | FIXED | Entry point và access-denied handler trả JSON thống nhất; backend suite đạt | Không có |
| Low | Stateless JWT không thu hồi token ngay khi logout | OPEN | Web xóa token và đóng socket; không có blacklist phía server | Token bị lấy cắp còn dùng được đến khi hết hạn, tối đa 1 giờ |

## 3. Các bảo vệ đã có và được giữ nguyên

JWT đã kiểm tra chữ ký, thuật toán và hạn dùng; mật khẩu dùng BCrypt. Service kiểm tra participant/owner cho chat, group, message, attachment và notification. Nearby dùng opt-in, dữ liệu mới trong 24 giờ, ô vị trí thô và khoảng cách làm tròn. Upload ảnh kiểm tra kích thước, MIME, giải mã ảnh thật, giới hạn chiều và re-encode; download yêu cầu membership và trả `no-store`/`nosniff`. React render nội dung người dùng dưới dạng text và không có `dangerouslySetInnerHTML`.

## 4. Lỗ hổng đã xác minh

Các vấn đề đã xác minh được liệt kê trong bảng mục 2. Audit không tìm thấy đường khai thác IDOR/BOLA ở các REST endpoint đã rà, bypass subscription STOMP, lộ tọa độ chính xác của người khác, hay traversal trong storage ảnh.

## 5. Các sửa đổi đã triển khai

- Thêm production profile bắt buộc DB credentials, JWT secret và CORS origins.
- Không lưu raw JWT trong phiên STOMP; dùng principal, username và expiry đã xác minh.
- Thêm giới hạn REST cho login, register, friend request, user search và gửi message/image.
- Thêm giới hạn realtime cho subscribe, typing và gửi message.
- Chuẩn hóa lỗi 401, 403 và 429; thêm `Retry-After`.
- Giới hạn input login và đặt response đăng nhập là `no-store`.
- Web có thông báo dự phòng rõ ràng cho 403, 413 và 429.

## 6. File thay đổi

Backend thay đổi security config, auth controller/DTO, STOMP interceptor và cấu hình môi trường; thêm `AbuseRateLimitFilter`, `RealtimeRequestGuard`, production profile và test rate-limit. Web thay đổi API client và test. `.env.example` và hai tài liệu audit/report được cập nhật. Mobile không thay đổi.

## 7. Ảnh hưởng tương thích API

Không đổi route, destination STOMP hoặc success payload. Response lỗi Spring Security nay dùng API JSON envelope hiện hành. Client vượt ngưỡng nhận 429 cùng `Retry-After`; đây là thay đổi tương thích có chủ đích. Mobile contract không bị sửa.

## 8. Database migration

Không có migration và không thay đổi schema.

## 9. JWT và authentication

Trạng thái: **FIXED / VERIFIED SAFE**. JJWT từ chối token thiếu, sai chữ ký, malformed và hết hạn; principal được tải lại từ user store. Production không có secret fallback. Login response không được cache. Test auth hiện có bao phủ missing/invalid/expired token và luồng đăng nhập.

## 10. Authorization

Trạng thái: **VERIFIED SAFE**. Profile lấy identity từ principal. Chat/group/message/attachment kiểm tra membership hoặc owner tại service/repository. Notification luôn scope theo user đăng nhập. Integration tests đa tài khoản bao phủ truy cập chat, group, notification và attachment trái phép.

## 11. WebSocket security

Trạng thái: **FIXED / VERIFIED SAFE**. CONNECT xác minh JWT và bind principal; SUBSCRIBE/SEND kiểm tra destination, user queue và membership. Sender lấy từ principal. Socket tự đóng khi token hết hạn. Raw JWT không còn được giữ trong session. Realtime request guard có bộ nhớ giới hạn.

## 12. Nearby privacy

Trạng thái: **VERIFIED SAFE**. Người dùng chỉ cập nhật vị trí của chính mình; tọa độ/radius được validate và request đã được giới hạn. Kết quả của người khác chỉ chứa vùng thô và khoảng cách làm tròn, tôn trọng discoverability và freshness. Test Nearby opt-out và location integration đạt.

## 13. Attachment security

Trạng thái: **VERIFIED SAFE**. Upload chỉ nhận image allowlist đã giải mã được, giới hạn size/dimensions và re-encode sang server-generated key. Download cần authentication và conversation membership; đường dẫn được normalize. Không có malware scanner, nên báo cáo không tuyên bố khả năng quét mã độc.

## 14. Rate limiting

REST mặc định: login 10/phút/client, register 5/giờ/client, friend request 20/phút/user, search 60/phút/user, message/image 120/phút/user. Realtime: subscribe 100/phút/user, typing 240/phút/user, message 120/phút/user. Không tin `X-Forwarded-For`; client chưa đăng nhập được nhận diện bằng socket address. Bộ nhớ tối đa 20.000 key và cửa sổ cũ được thay thế.

## 15. Production configuration

`application-prod.yml` bắt buộc `DB_HOST`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET` và `CORS_ALLOWED_ORIGINS`. SQL, Spring Security, messaging và WebSocket để mức INFO. Local development vẫn dùng base profile; `.env` thật không bị sửa. Health endpoint tối thiểu được giữ nguyên và không có Actuator exposure.

## 16. Kết quả Backend

- Compile: **PASS**.
- Targeted security/integration: **57/57 PASS**.
- Toàn bộ Maven test: **120 test, 0 failure, 0 error, 3 skipped — BUILD SUCCESS**.

## 17. Kết quả Web

- Production build: **PASS**.
- Vitest: **19 file, 171 test PASS**.
- Test mới xác minh thông báo dự phòng cho 403, 413 và 429.

## 18. Kiểm tra thủ công đã thực hiện

Không chạy thao tác trình duyệt thủ công trong lần này. Các kịch bản hai tài khoản về chat, group, notification, attachment, Nearby và WebSocket được thực hiện bằng integration tests trên H2 và server ngẫu nhiên. Rate-limit được kiểm tra bằng unit test với chuỗi request có kiểm soát.

## 19. Regression

Toàn bộ backend suite và web suite đạt, bao phủ auth, friends, Nearby, direct/group chat, pagination, read state, typing/presence, reply/reaction, image sharing, notification và realtime. Không chạy Mobile theo phạm vi prompt.

## 20. Rủi ro và giới hạn còn lại

- Rate limiter nằm trong bộ nhớ, theo từng application instance và reset khi restart; triển khai nhiều instance cần shared store ở milestone sau.
- Chỉ dùng socket address. Nếu chạy sau reverse proxy, cần cấu hình trusted proxy rõ ràng trước khi dùng forwarded headers.
- Logout JWT là phía client; chưa có server-side revocation.
- Web lưu token trong localStorage. React hiện không có unsafe HTML sink, nhưng XSS cùng origin vẫn có thể lấy token.
- Quan sát Nearby lặp lại vẫn có thể suy ra khu vực gần đúng dù API không trả tọa độ chính xác.
- `npm audit --omit=dev --audit-level=high`: **PASS, 0 vulnerabilities**. Backend chưa có dependency-audit plugin nên phần Maven advisory scan có trạng thái **NOT TESTED**.

Không còn phát hiện Critical hoặc High đang mở trong phạm vi prompt.

## 21. Milestone tiếp theo đề xuất

Thiết lập security checks trong CI, dependency scanning có nguồn advisory cố định, trusted-proxy policy và rate limiter dùng shared store khi triển khai đa instance. Cân nhắc refresh-token rotation hoặc revocation strategy trước khi yêu cầu đăng xuất cưỡng chế trên nhiều thiết bị.

PROMPT_040 COMPLETE
