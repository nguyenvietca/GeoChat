# Cấu hình môi trường

Các biến Backend hiện khai báo trong `application.yml`, `application-prod.yml` và
Compose đều có tên tương ứng trong `.env.example` và `.env` gốc. Các giá trị đã có
trong `.env` được giữ nguyên khi bổ sung biến thiếu. File này và `apps/web/.env`
được git-ignore; không đưa thông tin bí mật vào file mẫu.

| Nhóm | Biến | Nơi sử dụng |
| --- | --- | --- |
| Database | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | Backend local; Compose dùng service `postgres:5432`, còn `DB_PORT` là cổng publish ra host |
| Phiên đăng nhập | `JWT_SECRET`, `JWT_EXPIRATION_MS` | Backend, được Compose truyền vào container |
| Nhóm chat | `MAX_GROUP_MEMBERS` | Backend và build Web qua build arg `VITE_MAX_GROUP_MEMBERS` |
| Google | `GOOGLE_ENABLED`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_WEB_ORIGIN` | Backend |
| Super admin | `SUPER_ADMIN_BOOTSTRAP_ENABLED`, `SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | Bootstrap một lần khi khởi động Backend |
| Khôi phục mật khẩu | `PASSWORD_RESET_ENABLED`, `PASSWORD_RESET_WEB_ORIGIN`, `SMTP_*` | Backend gửi mail SMTP |
| Chống spam/bot | `RATE_LIMIT_ENABLED`, `REGISTRATION_BOT_CHECK_ENABLED`, `TURNSTILE_*` | Backend |
| Proxy | `TRUSTED_PROXY_HOSTS` | Backend local; Compose cố định tin service `web` |
| Push | `PUSH_NOTIFICATIONS_ENABLED`, `EXPO_ACCESS_TOKEN`, `EXPO_PUSH_URL` | Backend |
| Ảnh | `GEOCHAT_IMAGE_STORAGE`, `GEOCHAT_MAX_IMAGE_SIZE`, `GEOCHAT_IMAGE_TYPES` | Backend; Compose giữ đường dẫn ảnh trong container và volume hiện có |
| Web public | `VITE_API_BASE_URL`, `VITE_NEARBY_TILE_URL`, `VITE_NEARBY_TILE_ATTRIBUTION` | Build args từ `.env` gốc qua Compose/Dockerfile |

## Chạy bằng Compose

Compose đọc `.env` gốc và truyền các biến được khai báo trong `docker-compose.yml`.
`SPRING_PROFILES_ACTIVE=prod`, cổng nội bộ Backend `8080`, hostname Database và
proxy tin cậy được giữ theo cấu trúc mạng container. Các biến tương ứng trong `.env`
vẫn phục vụ việc chạy local, không thay thế các địa chỉ nội bộ này.

`VITE_API_BASE_URL` trống giữ API cùng origin trong production. Chỉ các biến `VITE_`
là cấu hình public của trình duyệt; không đặt SMTP secret, JWT secret, Google secret
hoặc mật khẩu super admin vào biến `VITE_`.

## Chạy local bằng IDE/Maven và Vite

- Backend: đặt các biến từ `.env` vào môi trường của tiến trình/run configuration.
  Spring không tự đọc file dotenv của Compose. Cấu hình Google local được git-ignore
  đang dùng vẫn được giữ nguyên.
- Web: Vite đọc `apps/web/.env`, có mẫu tại `apps/web/.env.example`. File này chứa
  cấu hình public, mặc định gọi Backend ở `http://localhost:8080`.
- Với local, đặt `VITE_MAX_GROUP_MEMBERS` của Web khớp `MAX_GROUP_MEMBERS` của Backend.
  Compose tự dùng cùng `MAX_GROUP_MEMBERS` cho hai phía.
- Khi sửa biến môi trường, restart tiến trình liên quan. Các biến `VITE_` trong bản
  production cần rebuild Web, không chỉ restart container Nginx.

Tham khảo [admin-and-password-recovery.md](admin-and-password-recovery.md) để cấu
hình SMTP và bootstrap super admin. Việc đồng bộ tên biến không tự bật tính năng
hay tự tạo credentials còn trống.

## Kiểm tra sau đồng bộ

- Không còn biến runtime bị thiếu hoặc khai báo trùng trong các file môi trường.
- 214 kiểm thử Web, 22 kiểm thử Backend liên quan, TypeScript và build Web đã qua.
- `docker compose config --quiet` hợp lệ; bước này kiểm tra cấu hình, không chạy
  container hay thay đổi Database.
- Không chạy kiểm tra Mobile hoặc thiết bị thật; không có thiết bị thật khả dụng.
