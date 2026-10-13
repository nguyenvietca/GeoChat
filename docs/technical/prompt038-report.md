# Báo cáo PROMPT_038 — Chat Performance & Pagination Optimization

## 1. Audit kiến trúc ban đầu

Backend tải lịch sử theo trang 20 tin nhắn bằng `OFFSET`, sắp xếp giảm dần theo `createdAt, id`, sau đó đảo lại để trả theo thứ tự thời gian. Reply, reaction và attachment đã được tải theo batch. Web giữ các trang đã tải trong state, khử trùng theo `messageId`, giữ vị trí bằng chênh lệch `scrollHeight`, chỉ tự cuộn cuối khi người dùng ở gần cuối. WebSocket được hủy khi đổi conversation. Ảnh dùng IntersectionObserver, kích thước cố định theo aspect ratio, request có JWT và object URL được thu hồi. Read cursor dựa trên message hiển thị và giữ quy tắc đơn điệu.

## 2. Bottleneck đã xác định

Lỗi có thể tái hiện là phân trang `OFFSET`: nếu có tin nhắn mới giữa trang đầu và trang kế tiếp, offset dịch chuyển và có thể trả trùng hoặc bỏ sót tin nhắn. Query lịch sử giữ khóa conversation trong transaction đọc dù không sửa dữ liệu. Typing/presence state nằm trong ChatPanel nên làm phần JSX của toàn bộ danh sách tin nhắn được tạo lại. Việc tải cũ chỉ có nút bấm, chưa kích hoạt khi người dùng cuộn lên.

## 3. Baseline và dữ liệu đại diện

- Trang đầu được giới hạn 20, Backend giới hạn tối đa 100.
- Bộ test mới chạy reconciliation với 100, 1.000 và 5.000 tin nhắn, gồm timestamp trùng và trang chồng lấn.
- Không có React Profiler hoặc PostgreSQL production dataset trong môi trường, vì vậy không công bố thời gian render/query giả định.
- Web full suite trước thay đổi của milestone có 163 test; sau thay đổi có 168 test.

## 4. Thay đổi đã triển khai

- Bổ sung keyset cursor `beforeCreatedAt + beforeId`, đồng thời giữ `page/limit` cũ.
- Response bổ sung `nextBeforeCreatedAt`, `nextBeforeId`, `hasMore` theo kiểu additive.
- Trang sau dùng điều kiện khóa tổng hợp, không bị dịch khi có realtime message mới.
- Tải cũ tự động khi người dùng thực sự cuộn lên gần đầu; ref khóa ngăn request đồng thời.
- Giữ nút Load older để hỗ trợ bàn phím, retry và accessibility.
- Memo hóa cây React của các message đã render để typing/presence không dựng lại message JSX khi message data không đổi.
- Giữ dedupe, reaction version, reply, image, sender grouping và `data-message-id`.

## 5. File thay đổi

Các file chính: `ChatPanel.tsx`, Web chat types/API/tests, `ChatController`, `ChatDtos`, `MessageRepository`, `ChatService`, `ChatIntegrationTest`, migration V17 và test dữ liệu lớn. Mobile không thay đổi.

## 6. So sánh trước/sau

Trước: trang cũ dùng offset nên concurrent insertion có thể thay đổi biên trang. Sau: cursor luôn lấy các row nhỏ hơn cặp `(createdAt, id)` của tin nhắn cũ nhất đã nhận; integration test chèn realtime message giữa hai request vẫn nhận đúng 20 + 5 row, không trùng. Đây là cải thiện correctness đã đo bằng test. Tác động thời gian thực thi production chưa được đo trên PostgreSQL thật.

## 7. Cải thiện truy vấn Backend

Query cursor có filter conversation, điều kiện tuple logic và order xác định. Transaction lịch sử chuyển sang read-only và không khóa conversation. V17 thay index hai cột bằng `(conversation_id, created_at DESC, id DESC)` để hỗ trợ filter, order và tie-break. Reply, reaction, attachment và sender preview tiếp tục batch load, không phát hiện N+1 mới.

## 8. Cải thiện render Web

Danh sách vẫn dùng key `messageId`. `useMemo` giữ nguyên message element tree qua các update typing/presence không liên quan. Test reconciliation 5.000 message xác nhận thứ tự và tính duy nhất. Chưa thêm virtualization vì chưa có profiler chứng minh DOM là bottleneck; lịch sử vẫn chỉ được tải từng trang theo yêu cầu người dùng.

## 9. Pagination và scrolling

Initial load vẫn là 20. Cursor xử lý timestamp giống nhau bằng ID. Realtime arrival không thay cursor. `loadingOlderRef` chặn request trùng. `useLayoutEffect` giữ viewport bằng chênh lệch chiều cao trước/sau prepend; image đã reserve aspect ratio. Auto-load chỉ chạy khi scrollTop giảm và gần đầu, tránh kích hoạt lúc mount.

## 10. WebSocket

Không đổi destination hay protocol. Subscription hiện tại tiếp tục cleanup khi ChatPanel unmount/đổi conversation. REST overlap, WebSocket echo và response send tiếp tục hợp nhất theo `messageId`. Reaction event cũ tiếp tục bị bỏ qua theo version. Không tạo reconnect hoặc subscription mới.

## 11. Kết quả Backend test

- Targeted `ChatIntegrationTest`: 19/19 PASS.
- Full Maven suite: 118 test chạy, 0 failure, 0 error, 3 test tùy chọn bị skip.
- Test mới xác minh cursor khi insert đồng thời, timestamp trùng, biên trang và không duplicate.

## 12. Kết quả Web build/test

- Production build: PASS, 65 modules.
- Vitest full suite với một worker: 19 files, 168/168 tests PASS.
- Lần chạy parallel đầu tiên hết RAM trong worker; chạy tuần tự hoàn tất và không có lỗi chức năng.
- Repository không có script lint riêng.

## 13. Kiểm thử thủ công thực tế

Không thực hiện phiên thủ công bằng hai tài khoản trên Backend/PostgreSQL thật. Edge headless fixture chạy 45 route/viewport; route chat DIRECT và GROUP đạt ở 375, 768, 1024 và 1440 px, không overflow và composer hiển thị. Bộ dò chung báo một cảnh báo overlap ở Profile 375 px ngoài phạm vi chat. Không có thiết bị thật.

## 14. Regression

DIRECT, GROUP, authorization, reply, reaction, image, typing, presence, unread/read cursor, Nearby-to-chat, Friends-to-chat và DIRECT reuse đều nằm trong full suite đạt. Read cursor vẫn chỉ tiến theo message quan sát được; API tải trang không tự mark read.

## 15. Tương thích Mobile

Không sửa source Mobile và không chạy Mobile build/typecheck/test. Endpoint cũ với `page/limit` vẫn hoạt động; các field cursor chỉ được bổ sung, không xóa field cũ. WebSocket destination và message IDs không đổi.

## 16. Giới hạn còn lại

- Chưa chạy EXPLAIN ANALYZE hoặc Flyway V17 trên PostgreSQL/PostGIS thật.
- Chưa có React Profiler/memory trace trong browser với 5.000 DOM node; test 5.000 message đo correctness của reconciliation, không đại diện commit time.
- Lịch sử tích lũy trong state khi người dùng chủ động tải nhiều trang; virtualization chưa có đủ bằng chứng để thêm dependency/phức tạp.
- Chưa hoàn thành manual verification hai tài khoản theo mục 36.

## 17. Milestone tiếp theo đề xuất

Chạy benchmark có kiểm soát trên PostgreSQL với 100/1.000/5.000 mixed messages, thu EXPLAIN ANALYZE và React Profiler trace. Chỉ triển khai variable-height windowing nếu số liệu DOM/memory cho thấy nhu cầu, đồng thời bổ sung browser E2E hai tài khoản cho realtime, read state và scroll anchoring.

PROMPT_038 NOT COMPLETE
