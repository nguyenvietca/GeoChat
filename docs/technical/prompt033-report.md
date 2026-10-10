# Báo cáo PROMPT_033

## 1. Kiến trúc WebSocket và presence hiện có

Backend dùng STOMP qua `/ws`, JWT khi CONNECT, Spring simple broker và interceptor kiểm tra phiên/quyền. Web dùng chung kết nối theo token trong `stompConnection.ts`; message, notifications, unread, group và presence cùng dùng hạ tầng này. Message vẫn được lưu qua ChatService và phát trên `/topic/chat/{conversationId}`. Presence hiện có dùng số phiên đang hoạt động theo user, không suy ra từ thao tác gõ.

## 2. Typing Indicator

Đã triển khai DIRECT/GROUP: gửi START khi bắt đầu nhập nội dung có ý nghĩa, refresh tối đa mỗi 3 giây khi tiếp tục nhập, STOP sau 2,2 giây không nhập. STOP khi xóa nội dung, blur, gửi thành công, ẩn tab, đổi chat hoặc unmount. Không phát khi composer chưa sẵn sàng hoặc hết hạn mức. Không xóa draft mới nếu request gửi draft cũ vừa hoàn tất.

Người nhận hiển thị từng người đang gõ, loại chính mình; nhiều người trong GROUP được tổng hợp. Tên dài được rút gọn nhưng giữ phần “is/are typing”; tooltip chứa đầy đủ tên. Mỗi người tự hết trạng thái sau 7 giây nếu mất STOP. Chuyển chat, reconnect và thay đổi visibility xóa trạng thái cũ.

## 3. Presence

Tái sử dụng registry và API presence hiện có. ONLINE khi phiên đầu tiên kết nối, OFFLINE khi phiên cuối cùng ngắt; mở/đóng một tab phụ không làm user offline. Serialize cập nhật số phiên với phát sự kiện để tránh ONLINE cũ xuất hiện sau OFFLINE. JWT hết hạn đóng phiên và cập nhật presence.

DIRECT hiển thị Online/Offline/Unknown; Unknown dùng khi chưa có dữ liệu đáng tin cậy. Tooltip giải thích đây là trạng thái kết nối, không phải bằng chứng đang xem chat. Khi peer offline, Web xóa typing của peer. Kiểm tra quyền presence được thực hiện lại lúc giao sự kiện.

## 4. Thay đổi Backend

Thêm DTO typing và handler riêng, xác thực identity bằng principal, kiểm tra participation và trạng thái phiên. Request có activityId giúp loại thao tác cũ bị xử lý muộn trong cùng phiên/chat; eventId từ server giúp loại delivery cũ ở Web. Cache thứ tự xóa khi phiên disconnect.

Membership check dùng truy vấn exists có join thay cho tải user/conversation riêng. Truy vấn UPDATE read-state vẫn giữ annotation Modifying. Không bật ordering toàn cục của Spring: thử nghiệm cho thấy cấu hình đó gây lỗi mutable headers khi fanout unread nhiều tab trong phiên bản hiện tại; thứ tự typing được xử lý trong protocol riêng và regression unread đã đạt.

Không thay schema, migration, REST, MessageResponse hoặc thêm dependency.

## 5. Thay đổi Web

Thêm parser, publisher và subscription typing vào kết nối dùng chung. Publisher bỏ qua sự kiện khi mất kết nối và xử lý lỗi đóng socket; không queue typing cũ. Subscription có generation guard để callback của phiên reconnect cũ không lọt vào UI.

ChatPanel quản lý timer, draft, danh sách người gõ và thứ tự sự kiện. Vùng typing dành sẵn 24 px, dùng theme tokens, có polite live region. Không thêm animation; giữ IME, smart scroll, unread, composer và đổi theme.

## 6. Các file thay đổi

- Web: `apps/web/src/features/chat/ChatPanel.tsx`, `apps/web/src/services/chatWebSocket.ts`, `apps/web/src/services/stompConnection.ts`, `apps/web/src/types/index.ts`, `apps/web/src/styles.css`.
- Web tests: `App.test.tsx`, `features/chat/MessagesPage.test.tsx`, `features/friends/FriendsChat.test.tsx`, `services/chatWebSocket.test.ts`; tất cả nằm trong `apps/web/src`.
- Browser harness: `apps/web/scripts/check-responsive.mjs`.
- Backend: `ChatDtos.java`, `ConversationParticipantRepository.java`, `ChatService.java`, `ChatWebSocketController.java`, `GroupConversationOutboundInterceptor.java`, `StompAuthenticationChannelInterceptor.java`, `WebSocketSessionRegistry.java`; nằm trong `backend/src/main/java/com/geochat/chat` theo package tương ứng.
- Backend tests: `backend/src/test/java/com/geochat/chat/ChatWebSocketIntegrationTest.java`, `websocket/WebSocketSessionRegistryTest.java`, `websocket/TypingPresenceOutboundInterceptorTest.java`.
- Tài liệu: `docs/PROMPT_034_PREPARATION.md`, báo cáo này. `AI_promt/prompt_033.md` là đầu vào yêu cầu có sẵn trong workspace.

## 7. Protocol realtime

Client SEND `/app/chat/{conversationId}/typing`:

```json
{"state":"START","activityId":1}
```

STOP dùng cùng destination với state STOP và activityId tăng dần. Backend chấp nhận state-only cho client chưa gửi activityId. Client SUBSCRIBE `/topic/chat/{conversationId}/typing`, nhận:

```json
{"conversationId":41,"senderId":22,"senderDisplayName":"Rowan","type":"TYPING","state":"START","eventId":1}
```

Không lưu typing vào bảng messages, không tạo notification/unread. Identity và eventId do server tạo, không lấy sender từ body.

## 8. Authorization

JWT bắt buộc khi CONNECT; interceptor kiểm tra membership khi SEND/SUBSCRIBE typing. Service xác thực lại membership trước relay. Outbound kiểm tra phiên còn hợp lệ và quyền hiện tại, nên thành viên bị loại không nhận tiếp typing. Presence outbound kiểm tra `canViewPresence`; không chỉ tin quyền lúc subscribe. Tests bao gồm giả sender, outsider, thành viên bị loại, group bị xóa và phiên hết hạn.

## 9. Hiệu năng và cleanup

Throttle phía Web, không phát theo từng keystroke; mỗi người nhận có timer expiry riêng, refresh cùng tên không cần cập nhật React state. Dùng cùng socket; không tạo connection mới. Cleanup timer/subscription trên switch, unmount, logout qua cơ chế disconnect có sẵn và reconnect. Callback cũ bị chặn ở cả transport và ChatPanel. Không query/lưu message cho typing.

## 10. Kiểm thử Backend

Java 21, `mvnw.cmd test`: **93 tests, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS**. Bao gồm DIRECT/GROUP typing thật qua STOMP/JWT, ba tài khoản trong GROUP, quyền nhận/gửi, replay activityId, không persistence, multi-tab presence, race count/publication và outbound privacy. Toàn bộ regression message/unread/read synchronization nhiều tab đạt.

Lượt chạy song song từng không khởi tạo được JVM vì thiếu native thread; chạy lại với `MAVEN_OPTS=-XX:ActiveProcessorCount=4` đã hoàn tất. Đây là giới hạn tài nguyên môi trường kiểm thử, không phải bỏ qua test.

## 11. Kiểm thử và build Web

`npm.cmd test`: **15 test files, 139 tests passed**. Bao gồm throttle, idle, expiry, nhiều người, own typing, STOP, switch, reconnect, callback cũ, event cũ, visibility, blur, gửi/xóa draft và đổi theme giữ selection/subscription.

`npm.cmd run build`: **PASS**, TypeScript và Vite production build hoàn tất. `git diff --check` đạt.

## 12. Xác minh giao diện thực hiện

Chạy Edge headless với API và STOMP fixtures ở **375/768/1440 px**, DIRECT và GROUP cho cả Light/Dark: **12 trường hợp đạt**. Kiểm tra overflow, control overlap, composer visibility, typing của chính mình bị loại, START throttle, STOP, vị trí composer và scroll đọc cũ không đổi. Đã xem ảnh chụp giao diện; artifacts trong `apps/web/build/prompt033/typing-light` và `typing-dark`.

Đây là kiểm tra trình duyệt tự động với fixtures; chưa thao tác thủ công bằng hai/ba tài khoản thật trong browser. Luồng server thật nhiều tài khoản được xác minh bằng integration tests ở mục 10. Không có thiết bị thật nên kiểm tra trên thiết bị vật lý được bỏ qua.

## 13. Regression

Web/Backend suite đều đạt, bao gồm gửi/nhận message, DIRECT/GROUP, friendship/quota, unread/read state, notifications và các chức năng hiện có trong test suite. Browser xác minh theme, responsive và không nhảy scroll khi typing. Không thay Mobile và không chạy Mobile build/typecheck/test. Không triển khai Reply/Reactions hoặc button placeholder.

## 14. Giới hạn còn biết

- Broker, registry presence và thứ tự typing còn process-local; nhiều instance cần coordination/routing được thiết kế riêng.
- Throttle là phía Web; không bổ sung tầng server rate-limit mới.
- Typing tổng hợp theo user: hai tab của cùng người cùng gõ thì STOP một tab có thể tạm ẩn user đến START refresh tiếp theo của tab kia. Presence vẫn đếm phiên độc lập đúng.
- STOP là best effort; socket mất đột ngột được dọn bằng receiver expiry. GROUP không subscribe presence từng thành viên.
- Backend tests dùng database test H2; chưa chạy trên PostgreSQL triển khai thật. Chưa kiểm tra mạng thật chậm/mobile vật lý hoặc tài khoản thật thủ công.

## 15. Tài liệu chuẩn bị PROMPT_034

`docs/PROMPT_034_PREPARATION.md` mô tả entity/DTO/API, ordering/pagination, boundary message row/read cursor, quyền hiện tại và hard-delete group. Tách rõ kiến trúc đã xác nhận khỏi thiết kế đề xuất.

## 16. Phạm vi đề nghị PROMPT_034

Reply với nullable reference cùng conversation và preview giới hạn, xử lý message gốc không khả dụng; reaction với uniqueness, aggregate summary và sự kiện version riêng; menu Reply/React/Copy có keyboard/accessibility. Trước khi code cần chốt deletion semantics, retry/order và compatibility decoder Mobile. Chỉ thêm migration/DTO/API khi milestone đó thực sự triển khai; tránh N+1 và giữ message/read contract hiện có.

Đã triển khai và kiểm thử: typing, presence improvements, authorization, cleanup, regression và responsive/themes bằng tự động. Đã triển khai nhưng chưa xác minh thủ công: sử dụng nhiều tài khoản thật trong browser/mạng thật. Chưa triển khai: Reply, Reactions, menu actions, schema tương ứng và multi-instance coordination.

PROMPT_033 COMPLETE
