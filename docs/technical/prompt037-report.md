# Báo cáo PROMPT_037 — Friend Discovery & Connection UX

## 1. Kiểm tra kiến trúc hiện có

GeoChat đã có module `friend` dùng một bản ghi `friend_requests` cho cả yêu cầu và quan hệ đã chấp nhận. Các trạng thái hiện hữu là `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`; migration V9 đã có unique index theo cặp không phân biệt chiều cho trạng thái đang hoạt động. Module chat đã dùng khóa cặp người dùng để mở lại DIRECT conversation. Web đã có Friends, Search, Nearby và public Profile nhưng trạng thái/action còn được xử lý rời rạc.

## 2. Chức năng được tái sử dụng

- Giữ các API gửi, hủy, chấp nhận, từ chối và xóa bạn hiện có.
- Giữ notification/WebSocket hiện có; không tạo hệ realtime mới.
- Giữ `openDirectConversation` để tái sử dụng DIRECT conversation và quy tắc lưu lịch sử khi hủy kết bạn.
- Giữ Nearby discoverability tách biệt với tìm kiếm toàn cục.
- Giữ route Search cũ để tương thích, đồng thời đưa Find People vào Friends.

## 3. Backend mới và được củng cố

- Search có phân trang 20 kết quả, tối đa trang 49, `hasMore`, chỉ lấy tài khoản ACTIVE, loại người hiện tại và giữ tìm kiếm không phân biệt hoa thường/Unicode.
- Kết quả search bổ sung `requestId` để Web thao tác trực tiếp với request đúng quyền.
- Thêm `GET /api/v1/friends/relationships/{userId}` trả một trong `NONE`, `PENDING_OUTGOING`, `PENDING_INCOMING`, `FRIENDS`.
- Gộp truy vấn trạng thái quan hệ và tải user theo lô, loại N+1 ở Search, Friends, Incoming và Outgoing.
- Khóa bi quan bản ghi khi accept/reject/cancel; xung đột unique khi gửi đồng thời được trả thành lỗi nghiệp vụ thay vì lỗi máy chủ.

## 4. Web mới

- Friends có bốn tab: Friends, Incoming, Sent và Find people.
- Find People debounce 300 ms, xóa kết quả khi đổi query, bỏ phản hồi cũ, phân trang và chống trùng.
- Kết quả có avatar ký tự, display name, username, trạng thái, Profile, Message và action phù hợp.
- Có thao tác gửi/hủy/chấp nhận/từ chối ngay trong kết quả.
- Friends có lọc cục bộ, profile link, mở DIRECT và hộp xác nhận xóa bạn.
- Các empty/loading/error/retry state được giữ hoặc bổ sung.

## 5. Mô hình trạng thái quan hệ

Web dùng duy nhất kiểu `FriendRelationship`: `NONE`, `PENDING_OUTGOING`, `PENDING_INCOMING`, `FRIENDS`. Backend suy ra trạng thái từ bản ghi `PENDING`/`ACCEPTED`; không tạo bảng hoặc enum quan hệ thứ hai. Mọi mutation chỉ đổi UI sau khi Backend xác nhận thành công.

## 6. Tích hợp Friends, Nearby và Profile

- Nearby hỗ trợ gửi, hủy, chấp nhận và từ chối tại chỗ.
- Public Profile tải endpoint trạng thái chung và hiển thị Add/Cancel/Accept/Message/Remove theo ngữ cảnh.
- Friends và Search đều liên kết public Profile.
- Message của bạn bè gọi DIRECT workflow hiện có; tin nhắn discovery trước kết bạn vẫn dùng workflow giới hạn hiện có.

## 7. Các file chính đã sửa

- Backend: `UserController`, `UserService`, `UserRepository`, search DTO; `FriendRequestController`, `FriendRequestService`, `FriendRequestRepository`, `FriendRelationshipResponse`.
- Web: `FriendsPage`, `SearchPage`, `NearbyPage`, `ProfilePage`, API clients, shared types và CSS.
- Tests: `FriendIntegrationTest`, `UserSearchIntegrationTest`, `App.test.tsx`, `FriendsChat.test.tsx`, responsive browser harness.

## 8. Database migration

Không thêm migration. V9 đã có partial unique index `uq_friend_requests_active_pair`, các index sender/status và receiver/status đã đủ cho truy vấn hiện tại. Không sửa migration đã áp dụng.

## 9. Kết quả Backend tests

Đã chạy full Maven suite sau thay đổi cuối: **117 tests, 0 failures, 0 errors, 3 skipped, BUILD SUCCESS**. Ba test bị skip là các kiểm tra PostgreSQL/PostGIS tùy chọn cần biến môi trường database thật; các test Friend/User liên quan chạy 14/14. Có kiểm tra search case-insensitive, Unicode tiếng Việt, self-exclusion, phân trang, privacy field, ownership, crossed request, lifecycle, relationship endpoint và xóa bạn.

## 10. Kết quả Web build/tests

- Production build: PASS, TypeScript và Vite build thành công.
- Vitest full suite: **18 files, 163 tests PASS**.
- Repository không có script lint riêng.
- `git diff --check`: PASS; chỉ có cảnh báo chuyển LF/CRLF cho một file TypeScript trên Windows.

## 11. Xác minh trình duyệt đã thực hiện

Đã chạy headless Edge với dữ liệu API fixture thực tế của UI trên Friends, Find People, Search và public Profile. Light và Dark đều kiểm tra ở 375 px, 768 px, 1440 px: **24 trang/lượt, 0 lỗi**, không horizontal overflow hay control ra ngoài viewport. Ảnh và JSON nằm tại `apps/web/build/prompt037/friends-light` và `friends-dark`.

Không thực hiện phiên kiểm thử thủ công hai tài khoản trên server đang chạy với dữ liệu production. Luồng hai phía được xác minh bằng Spring integration tests và Web component/integration tests. Không có thiết bị thật; Mobile không được kiểm tra theo phạm vi prompt.

## 12. Regression

Full Web suite bao phủ auth, Nearby, map/list, Friends, DIRECT/GROUP chat, unread/read, typing/presence, reply/reaction, image sharing, notification, theme và navigation. Full Backend suite đã chạy toàn bộ các module. Mobile source không thay đổi và không chạy Mobile build/typecheck/test.

## 13. Giới hạn còn lại

- Chưa có blocking/profile-visibility model trong repository, nên chỉ áp dụng ACTIVE status và các quy tắc privacy hiện hữu.
- Incoming counter lấy từ lần tải authoritative của Backend; notification realtime hiện hữu vẫn báo sự kiện nhưng chưa có friend-counter store realtime riêng, đúng yêu cầu không tạo WebSocket mới.
- Avatar hiện vẫn là chữ cái đầu vì user model chưa có public avatar URL.
- Search theo `%query%` phù hợp quy mô hiện tại; khi dữ liệu lớn cần đo query plan trước khi bổ sung index/trigram.
- Xác minh PostGIS tùy chọn không chạy trong lượt cuối vì không cung cấp kết nối database thật.

## 14. Milestone tiếp theo đề xuất

Ưu tiên một milestone về account privacy/blocking thống nhất. Khi có model đó, Search, Nearby, Profile, Friend request và contextual chat có thể dùng chung một policy Backend, kèm audit/rate limit và test PostgreSQL thật.

PROMPT_037 COMPLETE
