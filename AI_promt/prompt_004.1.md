Prompt 004 chưa được coi là hoàn tất.

Dựa trên implementation hiện tại và kết quả review, hãy chỉ sửa các gap của User + Authentication Foundation.

**Không implement feature mới. Không chuyển sang Friend/Location/Chat.**

## Current known issues

Các vấn đề hiện tại:

1. `AuthService.java` đang log password hash.
2. `application.yml` đang có JWT secret mặc định yếu.
3. `application.yml` đang có default DB username/password.
4. Test coverage còn thiếu:
   - validation failure
   - wrong password
   - unknown user
   - invalid JWT
   - expired JWT
5. Maven Wrapper của repository chưa chạy được vì thiếu `.mvn/wrapper`.
6. Test hiện tại đang pass bằng Maven cài global trên máy.
7. Register/Login/Me đã được kiểm tra tích hợp cơ bản nhưng chưa được manual verify đầy đủ với PostgreSQL.

---

# 1. Remove sensitive logging

Tìm toàn bộ authentication/security code.

Đặc biệt kiểm tra:

- `AuthService.java`
- login service
- JWT service
- authentication filter
- exception handler
- request/response logging

Không được log:

- plaintext password
- password hash
- JWT secret
- database password
- access token
- refresh token nếu sau này có
- Authorization header

Xóa hoặc thay đổi các log hiện tại đang expose password hash.

Nếu cần log authentication event, chỉ log thông tin không nhạy cảm, ví dụ:

- user id
- username/email đã được mask nếu cần
- authentication success/failure
- reason tổng quát

Không log credential.

Sau khi sửa, search toàn bộ source code để đảm bảo không còn log sensitive credential.

---

# 2. Secure configuration

Kiểm tra toàn bộ:

- `application.yml`
- `application-*.yml`
- `.env.example`
- Docker configuration
- test configuration

Không hard-code production-like secrets.

JWT secret phải được lấy từ environment variable hoặc external configuration.

Ví dụ:

```text
JWT_SECRET=${JWT_SECRET}
```

Không dùng secret yếu làm default production value.

Database credentials cũng phải được externalize.

Không dùng:

```text
username: postgres
password: postgres
```

như credential mặc định trong application configuration nếu configuration đó có thể được sử dụng ngoài local test.

Nếu local development cần example values, đặt chúng trong `.env.example` với giá trị rõ ràng là example/non-secret và document cách developer cấu hình local environment.

Không commit real credentials.

---

# 3. JWT secret validation

Không cho application silently chạy authentication với JWT secret yếu hoặc thiếu.

Nếu JWT secret bắt buộc:

- application phải fail fast khi secret chưa được cấu hình phù hợp.

Nếu implementation có yêu cầu minimum length/key strength:

- validate ngay lúc application startup.

Không tạo workaround kiểu:

```text
default-secret
secret
123456
geochat-secret
```

---

# 4. Complete authentication tests

Bổ sung test cho các trường hợp còn thiếu.

## Register

Test:

- register success
- duplicate user
- invalid request
- missing required field
- invalid email/username nếu validation rule áp dụng
- password validation failure nếu password policy có yêu cầu

## Login

Test:

- login success
- wrong password
- unknown user
- invalid request

Không expose implementation detail trong error response.

## JWT

Test:

- valid JWT
- invalid JWT
- malformed JWT
- expired JWT
- missing JWT
- protected endpoint without authentication

## `/users/me`

Test:

- valid token → 200
- missing token → unauthorized
- invalid token → unauthorized
- expired token → unauthorized

Không cần test implementation detail của framework.

---

# 5. Maven Wrapper

Repository phải build được bằng Maven Wrapper.

Kiểm tra:

```text
backend/
├── mvnw
├── mvnw.cmd
└── .mvn/
    └── wrapper/
        ├── maven-wrapper.properties
        └── required wrapper files
```

Nếu `.mvn/wrapper` thiếu file cần thiết thì sửa hoàn chỉnh.

Không phụ thuộc Maven global.

Validation phải sử dụng:

Windows:

```text
.\mvnw.cmd -version
.\mvnw.cmd test
.\mvnw.cmd -DskipTests compile
```

Nếu Maven Wrapper cần download Maven distribution thì cho phép wrapper thực hiện việc đó.

Không ghi nhận build thành công nếu chỉ chạy:

```text
mvn test
```

Mục tiêu là repository phải tự build bằng wrapper.

---

# 6. Manual verification

Nếu PostgreSQL đang available:

1. Start database.
2. Start Spring Boot application.
3. Register một user test.
4. Login bằng user đó.
5. Lấy JWT.
6. Gọi:

```text
GET /api/v1/users/me
Authorization: Bearer <JWT>
```

7. Verify response.
8. Verify password/password hash không xuất hiện.
9. Verify JWT secret không xuất hiện trong logs.
10. Thử request `/me` không có token.
11. Thử token invalid.

Không cần tạo script automation nếu project chưa có nhu cầu.

---

# 7. Security review

Sau khi sửa, tự audit source code.

Search các pattern có khả năng expose credential:

```text
password
passwordHash
secret
token
Authorization
```

Đảm bảo những giá trị sensitive không được log hoặc trả về API.

Kiểm tra DTO/Entity serialization để password hash không vô tình xuất hiện trong JSON.

---

# 8. Scope control

KHÔNG:

- thêm Friend
- thêm Location
- thêm Chat
- thêm Group
- thêm Notification
- thêm WebSocket
- thêm OAuth
- thêm social login
- thêm refresh token nếu hiện tại chưa có requirement
- thay đổi frontend/mobile
- refactor architecture không liên quan

Chỉ harden authentication foundation hiện tại.

---

# 9. Final validation

Chạy bằng Maven Wrapper:

```text
.\mvnw.cmd -version
```

```text
.\mvnw.cmd test
```

```text
.\mvnw.cmd -DskipTests compile
```

Nếu có thể:

- start PostgreSQL
- start application
- manual verify register/login/me

---

# Final report

Báo cáo chính xác:

### Security fixes
- sensitive logging
- JWT secret
- DB credentials
- configuration

### Tests
Liệt kê test cases mới và tổng số test pass.

### Maven Wrapper
Cho biết:

- wrapper version
- `mvnw.cmd -version`
- test result
- compile result

### Manual verification
Cho biết register/login/me và unauthorized request đã verify hay chưa.

### Remaining issues
Nếu còn vấn đề, ghi rõ.

### Completion status

Chỉ ghi:

`PROMPT_004 COMPLETE`

khi tất cả yêu cầu security, tests, wrapper và validation đã đạt.

Nếu còn bất kỳ yêu cầu nào chưa đạt, ghi:

`PROMPT_004 NOT COMPLETE`

và liệt kê chính xác phần còn thiếu.

Không tự động chuyển sang Prompt 005.