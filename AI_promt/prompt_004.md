Tiếp tục phát triển project GeoChat hiện tại.

Trước khi code, hãy đọc:

- `readme_structure.md`
- cấu trúc hiện tại của `backend`
- database migration hiện tại
- `pom.xml`

Spring Boot version đã được project chốt là:

- Java 21
- Spring Boot 4.1.0
- Maven Wrapper

**Không tự ý upgrade hoặc downgrade các version chính.**

# Goal

Implement feature đầu tiên có business logic thực tế:

**User + Authentication Foundation**

Mục tiêu là tạo một authentication flow tối thiểu nhưng có cấu trúc production-ready, dễ mở rộng cho các feature sau.

Flow:

```text
Client
  ↓
Register
  ↓
User
  ↓
Password hashing
  ↓
Login
  ↓
Authentication
  ↓
JWT Access Token
  ↓
Authenticated API
```

# 1. Database

Thiết kế migration cho User theo architecture hiện tại.

Tạo bảng user phù hợp với project.

Tối thiểu cần có:

- id
- username/email hoặc login identifier theo README
- password hash
- display name nếu architecture yêu cầu
- status
- created_at
- updated_at

Yêu cầu:

- primary key rõ ràng
- unique constraint cho login identifier
- NOT NULL cho field bắt buộc
- timestamp rõ ràng
- index phù hợp

Không lưu plaintext password.

Không tạo các bảng:

- friend
- chat
- group
- notification
- location

ở task này nếu chưa cần cho authentication.

Migration phải được tạo bằng Flyway.

Không sửa migration đã chạy trước đó.

# 2. Domain structure

Tạo module:

`user`

và:

`auth`

theo modular monolith architecture.

Giữ boundary rõ ràng:

```text
auth
 ├── controller
 ├── service
 ├── dto
 └── security

user
 ├── controller
 ├── service
 ├── repository
 ├── entity
 └── dto
```

Có thể điều chỉnh package structure nếu `readme_structure.md` đã quy định structure khác.

Không tạo abstraction chỉ để "đẹp architecture".

# 3. User

Implement:

### Register

API tạo user mới.

Yêu cầu:

- validate request
- kiểm tra duplicate login identifier
- hash password
- lưu user
- không trả password hash về client

### Get current user

Tạo API lấy thông tin user hiện tại từ authentication context.

Ví dụ:

`GET /api/v1/users/me`

Response chỉ chứa thông tin public của user.

Không trả:

- password
- password hash
- security secret

# 4. Authentication

Implement login.

Ví dụ:

`POST /api/v1/auth/login`

Flow:

```text
login request
    ↓
find user
    ↓
verify password
    ↓
create JWT
    ↓
return authentication response
```

JWT phải có:

- subject/user identifier
- issued time
- expiration time

Secret phải lấy từ environment variable/configuration.

Không hard-code JWT secret.

# 5. Password Security

Sử dụng password hashing phù hợp với Spring Security.

Không:

- MD5
- SHA-1
- plaintext
- tự implement password hashing algorithm

# 6. Spring Security

Thiết lập security configuration.

Các API:

Public:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
```

Authenticated:

```text
GET /api/v1/users/me
```

Các endpoint khác mặc định phải được bảo vệ.

Không dùng session-based authentication nếu architecture đã chọn JWT stateless authentication.

# 7. JWT

Implement JWT authentication filter/security integration phù hợp với Spring Boot 4.1.0 và Spring Security version tương ứng.

Request:

```text
Authorization: Bearer <token>
```

phải được authenticate trước khi truy cập protected endpoint.

Không viết security implementation phụ thuộc vào deprecated API nếu có API hiện hành tương đương.

# 8. Validation & Error Handling

Sử dụng validation cho request.

Các trường hợp cần xử lý rõ:

- invalid request
- duplicate user
- invalid username/email
- wrong password
- expired token
- invalid token
- missing authentication

Response error phải tuân theo global exception handling hiện tại.

Không expose internal exception stack trace cho client.

# 9. Tests

Viết test cho những flow chính:

### User

- register success
- duplicate user
- validation failure
- get current user

### Authentication

- login success
- wrong password
- unknown user
- protected endpoint without token
- protected endpoint with valid token
- protected endpoint with invalid/expired token

Ưu tiên test service/security logic quan trọng, không cần tạo hàng loạt test chỉ để tăng coverage.

# 10. API documentation

Nếu project đã sử dụng OpenAPI/Swagger thì document các API mới.

Nếu project chưa có OpenAPI thì **không tự thêm dependency chỉ để làm documentation** nếu README chưa yêu cầu.

# 11. Security requirements

Đặc biệt kiểm tra:

- password không xuất hiện trong response
- password hash không xuất hiện trong response
- JWT secret không xuất hiện trong response/log
- authentication stateless
- protected API không truy cập được nếu không authenticate
- credentials không hard-code

# 12. Validation

Sau khi implement:

```text
.\mvnw.cmd test
```

và:

```text
.\mvnw.cmd -DskipTests compile
```

Nếu có PostgreSQL:

- chạy migration
- start backend
- test register
- test login
- lấy JWT
- gọi `/api/v1/users/me`

Có thể dùng curl hoặc HTTP client để verify API.

# Scope control

KHÔNG implement:

- Friend
- Chat
- Group
- Notification
- Location
- Realtime WebSocket
- Push notification
- Social login
- OAuth
- Password reset
- Email verification

trong task này.

Không refactor các module không liên quan.

Không tự ý thay đổi frontend/mobile.

# Final report

Báo cáo:

### Changed
Files/modules đã tạo hoặc thay đổi.

### API
Danh sách endpoint và method.

### Database
Migration và bảng đã tạo.

### Security
Authentication/JWT/password hashing đã implement như thế nào.

### Tests
Test đã chạy và kết quả.

### Manual Verification
Register/Login/Me đã verify được hay chưa.

### Issues
Vấn đề còn tồn tại.

### Next Step
Đề xuất bước tiếp theo dựa trên architecture.

**Không tự động implement Next Step.**