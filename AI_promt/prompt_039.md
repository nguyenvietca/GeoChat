# PROMPT_039 — GeoChat Web Notifications

## Mục tiêu

Hoàn thiện trung tâm thông báo realtime cho GeoChat Web trên hạ tầng notification, JWT và STOMP hiện có.

## Phạm vi

### Sự kiện được hỗ trợ

- Tin nhắn DIRECT: thông báo cho người nhận, không thông báo người gửi.
- Tin nhắn GROUP: thông báo cho các thành viên hiện tại, trừ người gửi.
- Nhận lời mời kết bạn.
- Lời mời kết bạn được chấp nhận.
- Mỗi sự kiện chỉ tạo tối đa một notification cho một người nhận.
- Không lưu vị trí hoặc toàn bộ nội dung riêng tư trong notification.

### Backend

- Lưu notification với ID ổn định, người nhận, loại, reference, conversation, thời gian tạo và trạng thái đọc.
- Chống trùng theo người nhận, loại notification và reference.
- Tạo notification sau khi nghiệp vụ gốc commit thành công.
- Chỉ người nhận được xem hoặc đánh dấu notification đã đọc.
- Giữ các API:
  - `GET /api/v1/notifications`
  - `GET /api/v1/notifications/unread-count`
  - `POST /api/v1/notifications/{id}/read`
  - `POST /api/v1/notifications/read-all`
- Thêm:
  - `GET /api/v1/notifications/preferences`
  - `PUT /api/v1/notifications/preferences`
- Preferences gồm cảnh báo cho DIRECT, GROUP, lời mời kết bạn và lời mời được chấp nhận; mặc định bật.
- Preferences chỉ tắt alert/toast; notification vẫn được lưu trong trung tâm.
- Gửi realtime qua kết nối STOMP dùng chung tại `/user/queue/notifications`.
- Danh sách có giới hạn, mới nhất trước theo `created_at, id`.

### Web

- Chuông thông báo có unread badge và nhãn `99+`.
- Desktop dùng panel neo vào chuông; màn hình nhỏ dùng panel responsive.
- Trang Notifications có loading, empty, error, load more, mark one và mark all.
- Item có biểu tượng, tiêu đề, mô tả, thời gian và trạng thái đọc.
- Message điều hướng tới conversation; friend request tới incoming requests; accepted request tới Friends.
- Hiển thị tối đa ba toast realtime.
- Không hiện toast tin nhắn khi đang mở đúng conversation.
- Toast tuân theo preferences.
- Khử trùng notification theo ID.
- Khi reconnect hoặc tab trở lại foreground, đồng bộ trang gần nhất và unread count từ server.
- Dùng `BroadcastChannel` khi trình duyệt hỗ trợ để yêu cầu các tab đồng bộ lại.
- Settings có toggle notification preferences.
- Giữ khả năng dùng bàn phím, screen reader, Light/Dark theme và responsive layout.

## Ràng buộc

- Web-first; không sửa hoặc build Mobile.
- Không tạo WebSocket connection riêng cho notifications.
- Không thêm browser push hoặc service worker.
- Không thay đổi unread/read cursor của chat.
- Không thêm Redis, Kafka hoặc RabbitMQ.
- Không tự động xóa notification lịch sử.

## Kiểm thử

Backend:

- DIRECT/GROUP recipient selection và không gửi cho sender.
- Friend request và acceptance.
- Deduplication và transaction boundary.
- Recipient-only access/read.
- Mark one, mark all, unread count và pagination.
- Preferences mặc định, cập nhật và áp dụng cho alert.
- Realtime recipient isolation.

Web:

- Bell, badge, panel và các trạng thái danh sách.
- Realtime insertion, deduplication, read one/read all và navigation.
- Toast, active-conversation suppression và preferences.
- Reconnect, visibility và multi-tab reconciliation.
- Responsive và accessibility cơ bản.

Chạy Web production build, Web tests và Backend tests liên quan. Không chạy Mobile tests.

## Hoàn thành

Chỉ kết luận `PROMPT_039 COMPLETE` khi build và automated tests liên quan đều qua. Các kịch bản hai tài khoản hoặc trình duyệt chưa thực hiện phải được ghi rõ là chưa kiểm tra thủ công.

