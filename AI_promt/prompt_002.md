Hãy tiếp tục từ project hiện tại.

Trước tiên, đọc lại `readme_structure.md` và kiểm tra cấu trúc hiện tại của `backend`.

Mục tiêu của bước này chỉ là **chuẩn hóa backend build environment**, chưa implement business logic.

## Tasks

### 1. Kiểm tra Backend

Xác định:

- Spring Boot version
- Java version
- Maven version dự kiến
- groupId
- artifactId
- package root
- dependencies hiện tại

Không tự ý thay đổi các version đã được định nghĩa trong `readme_structure.md`.

### 2. Maven Wrapper

Nếu backend chưa có Maven Wrapper:

- Tạo `mvnw`
- Tạo `mvnw.cmd`
- Tạo `.mvn/wrapper/` cần thiết
- Sử dụng Maven Wrapper thay vì yêu cầu developer cài Maven global.

Maven Wrapper phải sử dụng Maven version phù hợp với project.

### 3. Backend dependencies

Chỉ giữ/thêm những dependency thực sự cần thiết cho backend foundation theo README.

Ở bước này chưa cần thêm dependency phục vụ business feature.

### 4. Configuration

Kiểm tra và chuẩn hóa:

- `application.yml` hoặc `application.properties`
- profile `dev` nếu README yêu cầu
- PostgreSQL configuration placeholder
- environment variables
- `.env.example` nếu phù hợp với architecture hiện tại

Không hard-code:

- database password
- secret key
- API key
- credential

### 5. Basic application

Đảm bảo Spring Boot application có thể start.

Nếu README yêu cầu health check thì tạo endpoint đơn giản cho health check.

Không tạo:

- Auth API
- User API
- Location API
- Friend API
- Chat API
- Group API
- Notification API

ở bước này.

### 6. Validation

Sau khi hoàn thành, sử dụng Maven Wrapper để validate backend:

Windows:

`mvnw.cmd -version`

Sau đó:

`mvnw.cmd -DskipTests compile`

Nếu compile thành công thì chạy thêm test nếu project hiện tại đã có test:

`mvnw.cmd test`

Nếu Maven Wrapper không thể chạy do môi trường hoặc network, không giả vờ rằng build thành công. Hãy báo chính xác lỗi.

### 7. Không làm ngoài phạm vi

Không:

- implement business logic
- tạo database schema domain
- tạo entity User/Location/Chat/etc.
- tạo REST API business
- thêm authentication
- thêm JWT
- thêm Docker infrastructure nếu README chưa yêu cầu ở bước này
- refactor architecture hiện tại nếu không cần thiết

## Final report

Sau khi hoàn thành, báo cáo ngắn gọn:

### Changed
Các file/folder đã tạo hoặc thay đổi.

### Backend Stack
Java / Spring Boot / Maven version.

### Validation
Các command đã chạy và kết quả.

### Issues
Các vấn đề còn tồn tại.

### Next Step
Đề xuất đúng bước tiếp theo dựa trên `readme_structure.md`.

Quan trọng:

**Chỉ thực hiện Backend Build Foundation trong task này. Không tự động chuyển sang business implementation.**