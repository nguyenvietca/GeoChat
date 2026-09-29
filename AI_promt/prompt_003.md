Tiếp tục từ project hiện tại.

Đọc lại `readme_structure.md` và kiểm tra backend hiện tại trước khi thay đổi.

Mục tiêu của task này là thiết lập **Database Foundation cho GeoChat**, sử dụng PostgreSQL + Flyway.

Không implement business feature trong task này.

## 1. PostgreSQL

Thiết lập PostgreSQL development environment theo architecture trong README.

Nếu README cho phép sử dụng Docker:

- Tạo `docker-compose.yml` hoặc file Docker configuration phù hợp.
- PostgreSQL chỉ dùng cho local development.
- Không hard-code password trong source code.
- Database credentials phải được cấu hình thông qua environment variables.

Nếu project đã có Docker configuration thì tận dụng configuration hiện tại thay vì tạo duplicate.

## 2. Spring Boot Database Configuration

Cấu hình backend để kết nối PostgreSQL thông qua environment variables.

Ví dụ các giá trị cần được configurable:

- DB host
- DB port
- DB name
- DB username
- DB password

Không hard-code credential.

Đảm bảo application có thể khởi động khi PostgreSQL đang chạy.

## 3. Flyway

Thiết lập Flyway theo version/dependency phù hợp với Spring Boot hiện tại.

Tạo migration structure rõ ràng.

Ví dụ:

`backend/src/main/resources/db/migration/`

Tạo migration đầu tiên chỉ để verify database migration pipeline hoạt động.

Không tạo toàn bộ domain schema ở bước này.

Migration đầu tiên có thể là một database foundation table rất đơn giản nếu README yêu cầu hoặc dùng một migration tối thiểu để verify Flyway.

Không tạo:

- users
- locations
- friends
- chats
- groups
- notifications

ở bước này.

## 4. Environment configuration

Kiểm tra:

- `application.yml`
- profile configuration nếu project đang sử dụng
- `.env.example`
- Docker configuration

Đảm bảo secret/password không được commit.

Nếu cần, cập nhật `.gitignore`.

## 5. Database validation

Sau khi setup:

1. Start PostgreSQL.
2. Run backend migration.
3. Verify Flyway migration thành công.
4. Verify Spring Boot có thể connect database.
5. Verify application start thành công.

Sử dụng Maven Wrapper:

`.\mvnw.cmd test`

và:

`.\mvnw.cmd -DskipTests compile`

Nếu có thể start application thì verify thêm runtime connection.

## 6. Migration safety

Đảm bảo:

- Migration có version rõ ràng.
- Migration không sửa trực tiếp sau khi đã chạy.
- Migration mới phải dùng version mới.
- Không dùng Hibernate auto schema generation để thay thế Flyway.
- Không dùng `ddl-auto=create` hoặc `create-drop` cho database development nếu điều đó bypass Flyway.

## 7. Scope control

KHÔNG implement:

- Authentication
- JWT
- User API
- Location API
- Friend API
- Chat API
- Group API
- Notification API
- Business logic

KHÔNG tự thiết kế domain database nếu `readme_structure.md` chưa định nghĩa.

Nếu README có yêu cầu khác với prompt này, ưu tiên `readme_structure.md` và báo lại sự khác biệt.

## Final report

Sau khi hoàn thành:

### Changed
Danh sách file đã tạo/thay đổi.

### Database
- PostgreSQL version
- Database name
- Flyway version
- Migration files

### Validation
Các command đã chạy và kết quả.

### Runtime
Backend có start và connect PostgreSQL thành công hay không.

### Issues
Các vấn đề còn tồn tại.

### Next Step
Đề xuất bước tiếp theo dựa trên `readme_structure.md`.

Chỉ thực hiện Database Foundation. Không tự động implement business feature.