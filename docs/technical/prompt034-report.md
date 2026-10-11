# Báo cáo PROMPT_034

Ngày xác minh: 11/10/2026.

## 1. Quyết định kiến trúc

Tiếp tục phần triển khai đã có trong workspace, kiểm tra thiết kế và hoàn thiện validation. Message vẫn dùng ID Long, conversationId, senderId, content và createdAt; ordering vẫn theo createdAt/ID. Reply là tham chiếu nullable đến message cùng conversation. Reaction là entity riêng, summary theo người xem; sự kiện riêng chỉ báo version để Web reconcile qua REST. Không gộp typing/reactions vào payload message chung và không tái sử dụng sequence typing.

## 2. Migration database

`backend/src/main/resources/db/migration/V13__add_message_replies_and_reactions.sql` bổ sung:

- `messages.reply_to_message_id`: nullable, self-FK `ON DELETE SET NULL`, index cho reply reference.
- `messages.reaction_version`: BIGINT NOT NULL DEFAULT 0, version bền vững theo message.
- `message_reactions`: message/user/emoji/createdAt, FK message và user `ON DELETE CASCADE`, unique `(message_id,user_id,emoji)`, emoji CHECK với sáu emoji hỗ trợ. Unique index phục vụ lookup theo message; có index user riêng.

Không sửa migration đã áp dụng, ID cũ và ordering không đổi. Group hard-delete messages tự cascade reactions trong database; reply FK được giải phóng mà không thêm soft-delete hay endpoint xóa message. PostgreSQL test đã xác minh legacy rows, duplicate/FK/emoji constraints, SET NULL, nested reply và cleanup khi xóa toàn bộ messages của group. Test tạo schema tạm trong transaction rồi rollback; không áp dụng V13 lên dữ liệu ứng dụng đang chạy.

## 3. Backend

ChatService kiểm tra membership và target cùng conversation cho reply/reaction. Reply cho phép tự trả lời và nested reply; preview chỉ lấy trực tiếp message gốc, excerpt giới hạn 160 code points. Preview và sender được tải theo lô, không truy vấn từng message.

Reaction add/remove idempotent; identity từ principal. Conversation lock dùng chung với gửi message, thay đổi membership và group deletion, serialize concurrent actions; unique constraint là lớp bảo vệ persistence. Chỉ tăng reaction_version khi trạng thái thật sự đổi. Event phát sau transaction commit; không tăng unread, không tạo message/notification reaction.

## 4. API contracts

Giữ POST/GET `/api/v1/chats/{conversationId}/messages`, read endpoint và các trường message bắt buộc. Send request thêm `replyToMessageId?: Long`; omit/null vẫn là normal message. MessageResponse thêm replyToMessageId, replyPreview `{messageId,senderDisplayName,excerpt}`, reactions `[{emoji,count,reactedByMe}]` và reactionVersion.

- PUT/DELETE `/api/v1/chats/{conversationId}/messages/{messageId}/reactions/{key}` trả state `{messageId,version,reactions}` theo user hiện tại.
- GET `/api/v1/chats/{conversationId}/reactions?messageIds=1,2` trả `{items:[state...]}`, tối đa 100 positive IDs, kiểm tra mọi target thuộc conversation được cấp quyền.
- Key URL an toàn: `thumbs-up`, `heart`, `laugh`, `surprised`, `sad`, `angry`; map tương ứng 👍 ❤️ 😂 😮 😢 😡. Reject key khác, không nhận userId client.

## 5. WebSocket contract

Persisted messages giữ `/topic/chat/{conversationId}` và MessageResponse có trường bổ sung. Reaction destination `/topic/chat/{conversationId}/reactions`, payload:

```json
{"conversationId":41,"messageId":7,"version":3}
```

Không broadcast user list hoặc reactedByMe của người khác. Inbound subscription và outbound delivery kiểm tra phiên/membership; thành viên bị loại không tiếp tục nhận reaction event.

Web loại duplicate/out-of-order bằng version per message, debounce 60 ms và gom ID để tải summary theo người xem. Reconnect reconcile toàn bộ IDs đã load, chia lô 100; không tải toàn lịch sử. Sự kiện cho message chưa load được giữ version để reconcile khi page đó xuất hiện. State snapshot cũ không ghi đè version mới hơn.

## 6. Giao diện Web

MessageActions cho cả incoming/outgoing: Reply, React, Copy text; không có Edit/Delete. Trigger luôn truy cập được bằng chuột, touch và keyboard. Menu dùng focus hook hiện có, hỗ trợ arrows/Home/End, Escape, click outside và trả focus. Picker sáu emoji dùng checkbox state; badge có count và aria-pressed, disable khi request đang chạy.

Reply giữ draft, focus composer; cancel trả focus và bỏ target. ChatPanel keyed theo conversation nên switch bỏ target cũ. Bubble quote scroll/focus original đã load; original ngoài page hiện tại có feedback, không tự tải toàn history. Mọi row giữ `data-message-id` cho read cursor.

Clipboard chỉ copy content, có feedback thành công/denied/unsupported. Styles dùng theme tokens, wrap reaction badges và touch targets. Khi menu thiếu chỗ phía trên vùng scroll, mở xuống dưới để tránh bị clip; lỗi này được phát hiện bằng ảnh browser và đã bổ sung regression test.

## 7. Files thay đổi

- Backend main, dưới `backend/src/main/java/com/geochat/chat`: `controller/ChatController.java`, `dto/ChatDtos.java`, `dto/SendMessageRequest.java`, `entity/Message.java`, `entity/MessageReaction.java`, `repository/MessageReactionRepository.java`, `service/ChatService.java`, `event/MessageReactionsChangedEvent.java`, `websocket/ChatWebSocketController.java`, `websocket/MessageReactionEventListener.java`, `websocket/GroupConversationOutboundInterceptor.java`, `websocket/StompAuthenticationChannelInterceptor.java`.
- Migration V13 nêu ở mục 2.
- Backend tests: `MessageActionsIntegrationTest.java`, `PostgresMessageActionsMigrationTest.java`, `ChatWebSocketIntegrationTest.java`, `websocket/TypingPresenceOutboundInterceptorTest.java` dưới `backend/src/test/java/com/geochat/chat`.
- Web dưới `apps/web/src`: `api/client.ts`, `api/reactions.ts`, `types/index.ts`, `features/chat/ChatPanel.tsx`, `features/chat/MessageActions.tsx`, `features/chat/reactions.ts`, `styles.css`, `services/chatWebSocket.ts` và các test tương ứng trong chat/services.
- Browser validation: `apps/web/scripts/check-responsive.mjs`; tài liệu: báo cáo này. Các prompt 034/035/036 là file yêu cầu trong workspace; không triển khai scope 035/036.

## 8. Hiệu năng

Reply originals/senders được batch; reaction summary dùng GROUP BY theo page IDs và stable emoji ordering, không trả toàn user list. Realtime event nhỏ, dùng socket chung; subscriptions được cleanup cùng message/typing. Busy guard chống thao tác chồng lên cùng message; không reload full history sau từng reaction. Message dedup/order và smart scroll giữ nguyên.

Conversation lock bảo đảm correctness đơn giản nhưng serialize reactions cùng conversation; đây là tradeoff cần đo tải trước khi tối ưu concurrency.

## 9. Kết quả Backend

Java 21, Maven Wrapper với `MAVEN_OPTS=-XX:ActiveProcessorCount=4`:

- Full `mvnw.cmd test`: **102 tests, 0 failures, 0 errors, 1 skipped; BUILD SUCCESS**. Test skipped là PostgreSQL opt-in.
- Chạy riêng với `GEOCHAT_VALIDATE_POSTGRES=true`: **PostgresMessageActionsMigrationTest 1/1 PASS, 0 skipped** trên PostgreSQL cục bộ. Như vậy test opt-in đã được thực thi bổ sung.

Coverage gồm normal/reply/nested/pagination/preview/compatibility, invalid/cross-conversation/unauthorized targets, aggregate/ordering/selected state, idempotent/concurrent duplicate, emoji/auth REST, removed member và hard-delete cleanup. Integration STOMP kiểm tra reply payload, reaction topic/version, outsider và member removal. Full suite còn bao gồm authentication/friends/messages/unread/typing/presence/group regression.

## 10. Kết quả Web

- `npm.cmd test -- --maxWorkers=1 --reporter=dot`: **17 files, 151 tests PASS**.
- `npm.cmd run build`: **PASS**, gồm TypeScript `tsc -b` và Vite production build.
- Không có script lint riêng trong package.json; không tạo hoặc tuyên bố đã chạy lint.
- `git diff --check`: PASS; Git có thông báo chuẩn hóa LF/CRLF, không có lỗi whitespace.

Test reply/cancel/send/switch/unloaded original; picker add/remove, badge counts, duplicate/stale version, reconnect với page cũ; menu keyboard/outside/focus, clipboard failures; phiên bản mới bổ sung trường hợp menu sát mép vùng scroll.

## 11. Xác minh thực sự đã làm

Edge headless tại **375/768/1440 px**, DIRECT/GROUP, Light/Dark: **12 trường hợp PASS**. Kiểm tra geometry menu/picker nằm trong viewport và vùng chat, touch target 44 px, reply composer/focus/cancel, composer visibility, navigation, không overflow ngang. Đã xem screenshot. Artifacts: `apps/web/build/prompt034/actions-light` và `actions-dark`.

Browser dùng API fixtures; không phải thao tác thủ công với hai tài khoản server thật. Scenarios nhiều user và realtime server được kiểm tra bằng integration tests JWT/STOMP; không tuyên bố đã thực hiện manual hai/ba tài khoản browser. Không có thiết bị thật nên physical-device checks skipped; không chạy Mobile checks.

## 12. Regression

Full Web/Backend suites đạt; message pagination/order/dedup, quota/friends, group management/deletion, unread/read synchronization, typing/presence/reconnect và logout paths trong suites tiếp tục hoạt động. Reaction Web test xác minh reading position/order không đổi. Browser xác minh Light/Dark/responsive của menu/picker. Reply cancel/send vẫn dùng composer và IME/Enter behavior hiện có.

## 13. Mobile compatibility

Chỉ đọc `apps/mobile/src/api/client.ts`, `types/chat.ts`, `services/chatWebSocketService.ts`. REST parse JSON theo TypeScript cast; STOMP parser kiểm tra năm trường message cũ và không reject trường bổ sung. Các field/type/endpoint/destination/auth cũ giữ nguyên nên additive DTO phù hợp decoder đã xem. Mobile chưa có UI Reply/Reactions; chưa xác minh runtime Mobile và không chạy build/typecheck/test. Git diff Mobile rỗng.

## 14. Giới hạn

Chưa manual nhiều tài khoản thật trong browser; chưa kiểm tra physical device. PostgreSQL test xác minh V13 trên schema tối thiểu cô lập, chưa chạy toàn chuỗi Flyway/deploy production. Broker/presence vẫn process-local; chưa thêm multi-instance coordination. Reaction refresh lỗi có feedback và retry; mất kết nối reconcile khi reconnect. Deep-link/fetch original chưa load được hoãn, message edit/delete và emoji tùy ý chưa triển khai.

## 15. Milestone kế tiếp

Đọc yêu cầu PROMPT_035 để chốt scope riêng. Ưu tiên kiểm tra end-to-end tài khoản thật và deployment migration trước phát hành; chỉ triển khai feature tiếp theo khi được yêu cầu. Không mở rộng PROMPT_034 sang edit/delete hoặc Native Mobile.

Đã triển khai và kiểm thử tự động: Reply/Reactions/menu, authorization, persistence, concurrency, realtime/reconnect, responsive/themes và regression. Đã triển khai nhưng chưa manual: browser nhiều tài khoản server thật. Chưa triển khai: deep-link message ngoài page, edit/delete, arbitrary emoji, multi-instance coordination và Mobile UI.

PROMPT_034 COMPLETE
