Bạn đang làm việc trong một project mới hoàn toàn.

Hiện tại trong repository chỉ có file:

`readme_structure.md`

Hãy đọc kỹ toàn bộ nội dung của `readme_structure.md` trước khi thực hiện bất kỳ thay đổi nào.

Mục tiêu của bước này là **khởi tạo project structure/skeleton**, chưa implement business logic.

## Yêu cầu

1. Đọc và phân tích `readme_structure.md`.
2. Bám sát architecture, technology stack, naming convention và folder structure được mô tả trong file.
3. Tạo toàn bộ folder/file skeleton cần thiết cho project.
4. Nếu project có backend:
   - Khởi tạo Spring Boot project phù hợp với version được ghi trong README.
   - Chuẩn bị package structure theo architecture trong README.
   - Chuẩn bị cấu hình PostgreSQL.
   - Chuẩn bị cấu trúc Flyway migration nếu README yêu cầu.
   - Tạo health check/basic endpoint nếu phù hợp.
5. Nếu project có web:
   - Khởi tạo đúng framework/version được README quy định.
   - Tạo cấu trúc folder cơ bản theo README.
6. Nếu project có mobile:
   - Khởi tạo đúng framework/version được README quy định.
   - Tạo cấu trúc folder cơ bản theo README.
7. Tạo các file cấu hình cần thiết như:
   - `.gitignore`
   - `.env.example`
   - README bổ sung nếu cần
   - Docker/configuration files nếu README yêu cầu.
8. Không tự ý thêm framework, library hoặc service bên ngoài architecture đã được định nghĩa trong `readme_structure.md`.
9. Không implement business feature.
10. Không tạo mock data hoặc fake API nếu chưa được yêu cầu.
11. Không tạo code thừa chỉ để "cho đủ folder".

## Nguyên tắc quan trọng

- `readme_structure.md` là source of truth cho architecture của project.
- Nếu README có chỗ chưa rõ hoặc mâu thuẫn, **không tự đoán và không tự thay đổi architecture**.
- Hãy dừng lại và báo rõ vấn đề cần quyết định.
- Ưu tiên code đơn giản, dễ đọc, phù hợp với người mới bắt đầu.
- Không over-engineering.
- Mọi dependency được thêm vào phải có lý do rõ ràng.

## Sau khi tạo project

Hãy kiểm tra:

- Project structure có đúng README không.
- Backend compile được.
- Frontend build được nếu đã tạo.
- Mobile project có thể chạy/build nếu đã tạo.
- Không có lỗi configuration cơ bản.
- Không có business logic ngoài phạm vi bước này.

Cuối cùng, KHÔNG cần giải thích dài dòng.

Hãy báo cáo theo format:

### Created
- danh sách những phần đã tạo

### Architecture
- cấu trúc project hiện tại

### Validation
- những build/test/check đã chạy
- kết quả

### Issues
- vấn đề còn tồn tại, nếu có

### Next Step
- đề xuất bước tiếp theo dựa trên `readme_structure.md`

Không tự động chuyển sang implement bước tiếp theo.