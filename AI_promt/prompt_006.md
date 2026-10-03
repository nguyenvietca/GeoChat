Tiếp tục phát triển GeoChat từ trạng thái hiện tại.

Trước khi code:

1. Đọc `readme_structure.md`.
2. Kiểm tra implementation hiện tại của:
   - `auth`
   - `user`
   - `location`
   - PostgreSQL
   - PostGIS
   - Flyway
   - global exception handling
3. Không thay đổi architecture hiện tại nếu không cần thiết.

## Fixed technology versions

Giữ nguyên các version chính hiện tại:

- Java 21
- Spring Boot 4.1.0
- Maven Wrapper
- PostgreSQL
- PostGIS
- Flyway

Không tự ý upgrade/downgrade version chính.

---

# Goal

Implement **Nearby User Search** sử dụng PostgreSQL + PostGIS.

Feature:

```text
Authenticated User
       ↓
Current Location
       ↓
Nearby Search
       ↓
PostGIS spatial query
       ↓
Users within radius
       ↓
Distance from current user
```

Ví dụ:

```text
GET /api/v1/locations/nearby?radius=5000
```

trả về những user trong bán kính 5 km.

**Chỉ implement backend API.**

Không implement UI Web/Mobile trong task này.

---

# 1. Nearby Search API

Tạo endpoint:

```text
GET /api/v1/locations/nearby
```

Query parameter:

```text
radius
```

Đơn vị:

**meters**

Ví dụ:

```text
GET /api/v1/locations/nearby?radius=5000
```

nghĩa là tìm user trong bán kính 5 km.

Nếu project đã có API convention khác trong README thì follow convention đó.

---

# 2. Authentication

Endpoint phải yêu cầu authentication.

Current user lấy từ authentication context/JWT.

Không cho client truyền:

```text
userId
latitude
longitude
```

để xác định vị trí search origin.

Search origin phải lấy từ current location của authenticated user.

Flow:

```text
JWT
 ↓
Current User
 ↓
Current Location
 ↓
PostGIS query
```

---

# 3. User without location

Nếu authenticated user chưa có current location:

Không thực hiện spatial query.

Trả error response phù hợp với global exception handling hiện tại.

Không sử dụng:

```text
0,0
```

hoặc coordinate mặc định.

Không lấy location từ request body để workaround.

---

# 4. Radius validation

Validate `radius`.

Yêu cầu:

- radius bắt buộc.
- radius > 0.
- không cho radius quá lớn.

Đặt maximum radius hợp lý cho use case của GeoChat.

Ví dụ:

```text
MAX_RADIUS_METERS = 100000
```

Nếu README đã định nghĩa giới hạn khác thì sử dụng giới hạn trong README.

Không hard-code magic number trong service.

Đưa thành constant/configuration phù hợp.

Các request:

```text
radius = 0
radius < 0
radius > MAX_RADIUS
missing radius
non-numeric radius
```

phải được xử lý rõ ràng.

---

# 5. PostGIS query

Sử dụng PostGIS để thực hiện spatial search.

Ưu tiên:

```text
ST_DWithin
```

để filter users trong radius.

Distance nên được tính bằng PostGIS.

Ưu tiên sử dụng:

```text
ST_Distance
```

hoặc function phù hợp với kiểu geographic coordinate hiện tại.

Không lấy toàn bộ location records về Java rồi tính khoảng cách bằng vòng lặp.

Không dùng Java Math/Haversine để thay thế database spatial query.

---

# 6. Coordinate system

Location hiện tại sử dụng:

```text
WGS84
SRID 4326
```

Đảm bảo query sử dụng đúng SRID.

Distance phải được trả về theo:

```text
meters
```

Không được nhầm giữa:

- degrees
- meters
- kilometers

---

# 7. Exclude current user

Kết quả nearby search **không được chứa chính authenticated user**.

Ví dụ:

```text
Current user = A

Nearby:
B
C
D

Không:
A
```

---

# 8. Response

Response nên có structure rõ ràng.

Ví dụ:

```json
{
  "items": [
    {
      "userId": "xxx",
      "displayName": "User B",
      "distanceMeters": 325.4
    },
    {
      "userId": "yyy",
      "displayName": "User C",
      "distanceMeters": 812.7
    }
  ],
  "radiusMeters": 5000
}
```

Chỉ trả về thông tin public của user.

Không trả:

- password
- password hash
- JWT
- email nếu privacy policy hiện tại không cho phép
- exact latitude
- exact longitude

Không expose location chính xác của người khác.

---

# 9. Sorting

Kết quả phải được sort theo:

```text
distance ascending
```

User gần nhất đứng trước.

Sorting nên được thực hiện ở database nếu phù hợp.

Không load toàn bộ kết quả về Java rồi mới sort.

---

# 10. Limit / Pagination

Không cho một request trả về số lượng user không giới hạn.

Thiết kế pagination hoặc giới hạn kết quả.

Có thể sử dụng:

```text
limit
offset
```

hoặc pagination convention hiện tại của project.

Nếu project chưa có pagination convention, sử dụng một giới hạn mặc định hợp lý.

Ví dụ:

```text
default limit = 20
max limit = 100
```

Không tạo magic number rải rác trong code.

---

# 11. Location freshness

Kiểm tra architecture hiện tại của Location.

Nếu location có `updated_at`, thiết kế nearby search để có thể loại bỏ location quá cũ nếu README/spec yêu cầu.

Nếu chưa có requirement về stale location:

**Không tự ý thêm business rule loại bỏ location cũ.**

Không invent requirement.

---

# 12. Privacy

Nearby search phải đảm bảo:

- chỉ authenticated user mới search được.
- không trả exact coordinate của người khác.
- không cho user query location của một user cụ thể.
- không expose toàn bộ location table.
- không log toàn bộ result location.
- không log exact coordinates unnecessarily.

Response chỉ nên expose:

```text
user identity cần thiết
distance
```

---

# 13. Database index

Kiểm tra spatial index trên location column.

Nếu chưa có:

Tạo migration phù hợp cho spatial index.

Ưu tiên index phù hợp với PostGIS query.

Ví dụ có thể sử dụng:

```text
GIST
```

cho geography/geometry column phù hợp.

Không tạo index thừa.

Đảm bảo query có thể sử dụng spatial index.

---

# 14. Repository

Spatial query nên nằm ở repository/data-access layer.

Không viết raw SQL trực tiếp trong Controller hoặc Service.

Nếu JPA/Hibernate hiện tại không hỗ trợ expression/query thuận tiện cho PostGIS:

Có thể sử dụng native query ở Repository.

Native SQL phải:

- parameterized
- không concatenate user input
- rõ ràng
- chỉ select dữ liệu cần thiết.

Không dùng:

```text
SELECT *
```

nếu chỉ cần một số column.

---

# 15. Service

Service chịu trách nhiệm:

1. Get authenticated user.
2. Get current location.
3. Validate radius.
4. Execute nearby repository query.
5. Map result sang response DTO.

Không đưa business logic vào Controller.

Không để Repository xử lý authentication.

---

# 16. Tests

Viết test cho các case:

### Authentication

- unauthenticated request → unauthorized
- authenticated request → success

### Current location

- current user has location → search
- current user has no location → proper error

### Radius

- valid radius
- radius = 0
- negative radius
- radius > maximum
- missing radius
- invalid radius format

### Search

- nearby user returned
- user outside radius not returned
- current user excluded
- results sorted by distance
- distance returned in meters

### Privacy

Verify response không chứa:

- latitude
- longitude
- password
- password hash
- JWT

### Pagination / limit

- default limit
- custom limit
- maximum limit

Nếu dùng integration test với PostgreSQL/PostGIS thì ưu tiên verify spatial behavior thật thay vì mock toàn bộ repository.

---

# 17. PostgreSQL/PostGIS integration test

Nếu project có khả năng chạy integration test với PostgreSQL:

Ưu tiên dùng PostgreSQL/PostGIS thật.

Không mock `ST_DWithin` hoặc `ST_Distance`.

Test dataset nên có các user:

```text
Current user
Nearby user 1
Nearby user 2
Far user
```

Ví dụ:

```text
Current:
10.7769, 106.7009

Nearby:
một user cách vài trăm mét

Far:
một user cách xa radius
```

Không cần dùng coordinate production thật.

---

# 18. Performance

Kiểm tra execution plan nếu có thể.

Mục tiêu:

- spatial index được sử dụng.
- không load toàn bộ location table vào memory.
- distance calculation được database xử lý.
- query chỉ select columns cần thiết.

Không premature optimize bằng caching hoặc Redis.

Không thêm Redis trong task này.

---

# 19. API example

Sau khi hoàn thành, API phải có thể hoạt động tương tự:

```text
GET /api/v1/locations/nearby?radius=5000&limit=20
Authorization: Bearer <JWT>
```

Response:

```json
{
  "items": [
    {
      "userId": "...",
      "displayName": "...",
      "distanceMeters": 325.4
    }
  ],
  "radiusMeters": 5000
}
```

Không expose exact location của nearby users.

---

# 20. Scope control

KHÔNG implement:

- Friend request
- Add friend
- Chat
- Group
- Notification
- WebSocket
- Realtime location
- Location sharing
- Map UI
- Google Maps
- Mapbox
- Geocoding
- Reverse geocoding
- Redis
- recommendation algorithm
- ranking/recommendation system

Task này chỉ là:

**Authenticated Nearby User Search using PostGIS.**

---

# 21. Validation

Sau khi implement:

```text
.\mvnw.cmd test
```

```text
.\mvnw.cmd -DskipTests compile
```

Nếu PostgreSQL/PostGIS available:

1. Start PostgreSQL.
2. Run Flyway migrations.
3. Start Spring Boot.
4. Register multiple users.
5. Login.
6. Set location cho các user test.
7. Call:

```text
GET /api/v1/locations/nearby?radius=5000
```

8. Verify:
   - nearby users xuất hiện.
   - far users không xuất hiện.
   - current user không xuất hiện.
   - distance đúng và tính bằng meters.
   - kết quả sort gần → xa.
   - không expose exact coordinates.

---

# Final report

Báo cáo:

### Changed
Files/modules đã tạo hoặc thay đổi.

### API
Endpoint + request parameters + response.

### PostGIS
- spatial function sử dụng
- SRID
- distance unit
- spatial index

### Query
Giải thích ngắn gọn query strategy.

### Tests
Test cases + kết quả.

### Manual Verification
Kết quả test thực tế với PostgreSQL/PostGIS.

### Performance
Index/query verification nếu đã thực hiện.

### Security & Privacy
Các dữ liệu được expose và các dữ liệu bị ẩn.

### Issues
Các vấn đề còn tồn tại.

### Completion status

Chỉ ghi:

`PROMPT_006 COMPLETE`

khi toàn bộ requirements đạt.

Nếu còn bất kỳ requirement nào chưa đạt:

`PROMPT_006 NOT COMPLETE`

và liệt kê chính xác phần còn thiếu.

Không tự động chuyển sang Prompt 007.