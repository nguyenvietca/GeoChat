Tiếp tục phát triển GeoChat từ trạng thái hiện tại.

Trước khi code:

1. Đọc `readme_structure.md`.
2. Kiểm tra implementation hiện tại của:
   - auth
   - user
   - database
   - Flyway
   - PostgreSQL configuration
3. Không thay đổi architecture hiện tại nếu không cần thiết.
4. Giữ nguyên:
   - Java 21
   - Spring Boot 4.1.0
   - Maven Wrapper
   - PostgreSQL
   - Flyway

Không tự ý upgrade/downgrade các version chính.

# Goal

Implement **Location Foundation** cho GeoChat.

Mục tiêu:

```text
Authenticated User
       ↓
Update current location
       ↓
PostgreSQL/PostGIS
       ↓
Store coordinates
       ↓
Get current location
```

Đây là foundation cho các feature "Tìm quanh đây" sau này.

**Không implement nearby search trong task này.**

---

# 1. PostgreSQL / PostGIS

Kiểm tra database hiện tại có PostGIS hay chưa.

Nếu README yêu cầu PostGIS:

- đảm bảo PostgreSQL có PostGIS extension.
- tạo Flyway migration để enable extension nếu phù hợp với environment.

Không hard-code database-specific setup ngoài migration/configuration cần thiết.

Nếu PostGIS đã được enable, không tạo duplicate migration.

---

# 2. Location domain

Tạo module:

```text
location
```

theo modular monolith architecture hiện tại.

Giữ package boundary rõ ràng:

```text
location
├── controller
├── service
├── repository
├── entity
└── dto
```

Nếu project hiện tại dùng structure khác thì follow structure hiện tại thay vì tạo architecture mới.

---

# 3. Database schema

Tạo Flyway migration cho user location.

Thiết kế schema tối thiểu để lưu vị trí hiện tại của user.

Cần hỗ trợ:

- user reference
- latitude
- longitude
- geographic point nếu sử dụng PostGIS
- updated_at

Một user chỉ có **một current location** trong foundation này.

Không lưu lịch sử location ở task này.

Không tạo location history table.

Không tạo nearby/search table.

---

# 4. Geographic data

Nếu sử dụng PostGIS:

Ưu tiên sử dụng PostgreSQL/PostGIS geographic type phù hợp cho location search về sau.

Coordinate phải dùng:

```text
WGS84 / SRID 4326
```

Đảm bảo:

- latitude hợp lệ: `-90 <= latitude <= 90`
- longitude hợp lệ: `-180 <= longitude <= 180`

Không chấp nhận coordinate invalid.

Không tự sửa/normalize coordinate sai.

Nếu input invalid → trả validation error.

---

# 5. User relationship

Location phải thuộc về authenticated user.

Không cho client truyền tùy ý `userId` để update location của user khác.

Ví dụ:

```text
POST /api/v1/locations/me
```

hoặc endpoint tương đương theo REST convention hiện tại.

User identity phải lấy từ authentication context/JWT.

---

# 6. Update current location

Implement API cập nhật vị trí hiện tại.

Request tối thiểu:

```json
{
  "latitude": 10.7769,
  "longitude": 106.7009
}
```

Có thể thêm accuracy/timestamp nếu architecture trong README yêu cầu.

Business rule:

- authenticated user mới được gọi API.
- create nếu user chưa có location.
- update nếu user đã có location.
- không tạo duplicate current location cho cùng một user.

Response không được expose thông tin security-sensitive.

---

# 7. Get current location

Implement:

```text
GET /api/v1/locations/me
```

Response:

```json
{
  "latitude": 10.7769,
  "longitude": 106.7009,
  "updatedAt": "..."
}
```

Nếu user chưa có location:

- trả response phù hợp với API convention hiện tại.
- không tạo fake/default location.

---

# 8. Validation

Validate:

### Latitude

```text
-90 <= latitude <= 90
```

### Longitude

```text
-180 <= longitude <= 180
```

### Null

Latitude/longitude không được null.

### Authentication

Không authenticated → unauthorized.

### Ownership

Không được update/read location bằng cách truyền user ID của người khác.

---

# 9. Privacy / security

Location là dữ liệu nhạy cảm về privacy.

Không log:

- exact latitude/longitude unnecessarily
- full location object trong production-style logs

Không trả location của user khác ở API này.

Không thêm API:

```text
GET /users/{id}/location
```

ở task này.

Không expose location thông qua User entity serialization.

---

# 10. Tests

Viết tests cho các case chính.

## Update location

- create current location
- update existing location
- valid latitude/longitude
- invalid latitude
- invalid longitude
- null latitude
- null longitude
- unauthenticated request

## Get location

- existing location
- user without location
- unauthenticated request

## Ownership

Verify authenticated user A không thể thao tác location của user B thông qua request parameter/body.

## Database

Verify Flyway migration chạy thành công.

Nếu sử dụng PostGIS:

- verify PostGIS extension
- verify geographic column/SRID phù hợp.

Không cần tạo test dư thừa chỉ để tăng coverage.

---

# 11. API error handling

Sử dụng global exception handling hiện tại.

Không tạo một error response format thứ hai.

Các lỗi validation phải sử dụng convention hiện tại của project.

---

# 12. Transaction

Service layer phải có transaction boundary hợp lý.

Không thêm transaction ở mọi method một cách máy móc.

---

# 13. Nearby search

KHÔNG implement trong Prompt 05:

- radius search
- `ST_DWithin`
- distance calculation
- nearest users
- map clustering
- geofencing
- location sharing
- realtime location
- WebSocket location update

Những phần này sẽ được implement ở một prompt riêng sau khi Location Foundation ổn định.

---

# 14. Frontend / Mobile

Không cần implement UI hoàn chỉnh.

Nếu project architecture yêu cầu API client type/model foundation cho web/mobile thì chỉ tạo phần tối thiểu cần thiết.

Không tạo location UI hoàn chỉnh.

Không yêu cầu browser GPS permission flow trong task này.

Không implement mobile GPS background tracking.

---

# 15. Validation

Sau khi implementation:

```text
.\mvnw.cmd test
```

```text
.\mvnw.cmd -DskipTests compile
```

Nếu PostgreSQL/PostGIS available:

1. Start database.
2. Run Flyway migration.
3. Start Spring Boot.
4. Register/login.
5. Lấy JWT.
6. Update current location.
7. Get current location.
8. Verify invalid coordinates.
9. Verify unauthenticated request.

---

# 16. Code quality

Không:

- tạo generic repository abstraction không cần thiết
- tạo excessive interfaces
- tạo DTO mapper framework nếu project chưa cần
- duplicate validation logic
- expose Entity trực tiếp từ Controller
- hard-code user ID
- hard-code coordinates

Ưu tiên code đơn giản, rõ ràng, dễ maintain.

---

# Final report

Báo cáo:

### Changed
Files/modules đã tạo hoặc thay đổi.

### Database
- migration
- table
- PostGIS extension
- geographic type/SRID

### API
Danh sách endpoint.

### Validation
Các validation rule.

### Security & Privacy
Cách đảm bảo user chỉ thao tác location của chính mình.

### Tests
Test cases và kết quả.

### Manual Verification
Register → Login → Update Location → Get Location.

### Issues
Các vấn đề còn tồn tại.

### Completion status

Chỉ ghi:

`PROMPT_005 COMPLETE`

khi tất cả requirements đã đạt.

Nếu còn bất kỳ requirement nào chưa đạt:

`PROMPT_005 NOT COMPLETE`

và liệt kê chính xác phần còn thiếu.

Không tự động chuyển sang Prompt 006.