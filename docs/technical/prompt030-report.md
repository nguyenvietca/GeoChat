# B?o c?o PROMPT_030 ? unread v? read state tr?n Web

## K?t qu?

?? tri?n khai v? ki?m th? t? ??ng ??y ?? unread cho DIRECT/GROUP, cursor ??c ri?ng t?ng ng??i, badge, filter All/Unread v? ??ng b? realtime nhi?u tab. C?c acceptance criteria ???c x?c nh?n b?ng ki?m th? Backend/Web v? ki?m tra m?. Giao di?n th?t v? migration PostgreSQL/PostGIS ch?a ???c ki?m ch?ng th? c?ng trong phi?n n?y.

## H? t?ng c? s?n v? ph?n b? sung

Tr??c thay ??i, notification ?? c? read/unread ri?ng nh?ng h?i tho?i ch?a c? cursor ??c. DIRECT v? GROUP d?ng chung b?ng messages, kh?a s? Long v? th? t? l?ch s? createdAt r?i messageId. B?ng conversation_participants ?? x?c ??nh quy?n truy c?p; queue conversation-activity ?? ph?c v? preview/sorting.

Tri?n khai m? r?ng nh?ng th?nh ph?n n?y, kh?ng t?o b?ng read-state tr?ng l?p. Notification read state v?n gi? nguy?n v? ??c l?p v?i unread c?a h?i tho?i.

## Files thay ??i

Web:
- apps/web/src/types/index.ts
- apps/web/src/api/chats.ts v? chats.test.ts
- apps/web/src/services/chatWebSocket.ts v? chatWebSocket.test.ts
- apps/web/src/features/chat/MessagesPage.tsx v? MessagesPage.test.tsx
- apps/web/src/features/chat/ChatPanel.tsx
- apps/web/src/features/chat/messagePresentation.ts v? messagePresentation.test.ts
- apps/web/src/features/chat/useConversationRead.ts v? useConversationRead.test.tsx (m?i)
- apps/web/src/styles.css: ph?n filter, badge v? nh?n m?nh unread. S?a CSS group-leave-button xu?t hi?n song song trong workspace ???c gi? nguy?n, kh?ng thu?c tri?n khai unread.

Backend:
- backend/src/main/java/com/geochat/chat/entity/ConversationParticipant.java
- backend/src/main/java/com/geochat/chat/repository/ConversationParticipantRepository.java
- backend/src/main/java/com/geochat/chat/repository/UnreadStateRow.java (m?i)
- backend/src/main/java/com/geochat/chat/service/ChatService.java
- backend/src/main/java/com/geochat/chat/dto/ChatDtos.java
- backend/src/main/java/com/geochat/chat/dto/MarkConversationReadRequest.java (m?i)
- backend/src/main/java/com/geochat/chat/controller/ChatController.java
- backend/src/main/java/com/geochat/chat/event/ConversationReadEvent.java (m?i)
- backend/src/main/java/com/geochat/chat/websocket/ConversationActivityEventListener.java
- backend/src/main/java/com/geochat/chat/websocket/StompAuthenticationChannelInterceptor.java
- backend/src/main/resources/db/migration/V12__add_conversation_read_cursors.sql (m?i)
- backend/src/test/java/com/geochat/chat/ChatIntegrationTest.java
- backend/src/test/java/com/geochat/chat/ChatWebSocketIntegrationTest.java

T?i li?u: docs/product/business-rules.md v? b?o c?o n?y. AI_promt/prompt_030.md ???c ??c v? gi? nguy?n.

## Migration v? read state Backend

V12 b? sung last_read_message_id, last_read_message_at v? read_state_version v?o conversation_participants, c?ng constraint y?u c?u c?p cursor ??ng th?i null ho?c c? gi? tr? v? index messages(conversation_id, created_at, id). Kh?ng s?a migration ?? ?p d?ng. Khi kh?i ??ng Backend v?i Flyway, V12 s? ???c ?p d?ng theo c? ch? hi?n c?.

Cursor thu?c t?ng user/conversation, l?y timestamp v? ID t? message th?c s? t?n t?i trong h?i tho?i ???c c?p quy?n. So s?nh tuple (createdAt, messageId), kh?ng d?ng ID ??n l? ho?c timestamp do client g?i. Cursor ch? ti?n, g?i l?i ho?c g?i cursor c? kh?ng l?m l?i tr?ng th?i. L??t g?i v? l??t mark-read gi? kh?a conversation trong transaction ?? tr?nh tranh ch?p; phi?n b?n activity ???c c?p nh?t b?ng m?t c?u SQL bulk cho c?c th?nh vi?n.

Unread ???c ??m trong DB, lo?i tr? senderId c?a ch?nh ng??i ?ang ??c. Null cursor ngh?a l? ch?a c? l?ch s? ??c ???c x?c nh?n; v? v?y d? li?u c? sau n?ng c?p c? th? ???c t?nh unread ??n khi ng??i d?ng xem chat. H?i tho?i r?ng c? unread = 0. Group b? x?a ho?c th?nh vi?n b? lo?i b? kh?ng c?n ???c truy c?p hay nh?n summary.

## API v? t??ng th?ch

GET /api/v1/chats gi? t?t c? tr??ng c?, b? sung unreadCount, readStateVersion v? readStateSince. readStateSince l? createdAt c?a membership hi?n t?i, d?ng ?? ph?n bi?t phi?n membership m?i sau khi r?i/v?o l?i nh?m; kh?ng c?n th?m c?t epoch ri?ng.

POST /api/v1/chats/{conversationId}/read nh?n { "messageId": 123 }. User ???c l?y t? principal. Endpoint ki?m tra conversation, membership v? message cursor, r?i tr? conversationId, unreadCount, readStateVersion, readStateSince c?a ch?nh user. Cursor thi?u/kh?ng h?p l?/thu?c h?i tho?i kh?c b? t? ch?i; ng??i ngo?i b? 403, h?i tho?i b? x?a b? 404. Kh?ng t? suy ra latest message v? kh?ng nh?n userId ?? quy?t ??nh quy?n.

Contract g?i tin, ph?n trang v? c?c tr??ng response hi?n c? kh?ng ??i. Mobile kh?ng ph?i g?i th?m d? li?u ho?c d?ng endpoint m?i.

## UI, filter v? x?c nh?n ??c

Sidebar hi?n th? badge 1?99 ho?c 99+, v?i aria-label ch?a s? th?t. T?n/preview unread ???c nh?n m?nh; s? 0 kh?ng hi?n badge. Preview, timestamp, titleHint, scrollbar-gutter v? layout 40/60 hi?n c? ???c gi?.

All/Unread d?ng button aria-pressed, l?c local c?ng query search v? th? t? latest activity. Kh?ng refetch khi ??i filter. H?i tho?i v?a ???c ??c c? th? bi?n m?t kh?i danh s?ch Unread nh?ng route, panel, draft v? scroll v?n gi? nguy?n. Empty state ph?n bi?t kh?ng c? unread v? search kh?ng c? k?t qu? unread.

Hook x?c nh?n ??c ch? ho?t ??ng sau khi l?ch s? ?? t?i, document visible v? c? focus. Boundary l? message c? ph?n cu?i n?m trong v?ng chat v? viewport tr?nh duy?t th?c s? nh?n th?y. Tin m?i ? ngo?i v?ng ??c c? kh?ng ???c x?c nh?n. Boundary ???c ?o l?i sau debounce 240 ms; scroll, IntersectionObserver, focus, visibility v? resize gi?p c?p nh?t. Timestamp tr?n Web gi? ?? ch?nh x?c d??i millisecond tr??c khi d?ng ID ph? tie.

Kh?ng c? optimistic clear badge. Khi API th?t b?i, unread v?n gi? tr?ng th?i server; t??ng t?c xem ti?p theo c? th? retry cursor idempotent. Cursor ?? x?c nh?n kh?ng b? g?i l?i; timer/observer/listener v? callback async ???c cleanup khi ??i chat. Kh?ng toast cho m?i mark-read th?nh c?ng.

## Realtime v? nhi?u tab

Activity queue ti?p t?c c?p nh?t preview/order, b? sung snapshot unread c? version ri?ng t?ng user. Frontend kh?ng t?ng counter theo m?i socket frame; n? ?p d?ng snapshot server v? b? qua version c?, duplicate ho?c lifetime membership c?. REST/topic duplicate kh?ng l?m t?ng unread.

Queue ri?ng /user/queue/conversation-read g?i read state sau commit ??n c?c session c?a ch?nh ng??i ??c. Kh?ng broadcast read receipts cho ??i ph??ng. Hai queue d?ng k?t n?i STOMP theo token hi?n c?, ??ng k? m?t l?n ? MessagesPage v? cleanup khi r?i page/logout.

Reconnect d?ng reconciliation ?? c?; window focus b? sung refresh summary kh?ng b?t global spinner v? kh?ng t?i l?i friends. Snapshot c? kh?ng ?? read state/preview m?i, k? c? read event ??n tr??c khi danh s?ch ban ??u t?i xong; h?i tho?i m?i xu?t hi?n trong th?i gian request ?ang ch?y ???c gi?. GROUP_DELETED v? membership removal ti?p t?c x?a entry v? ch?n callback ??n tr?.

## Hi?u n?ng

Unread t?t c? conversation ???c t?nh b?ng m?t aggregate query, kh?ng N+1 v? kh?ng t?i histories ?? ??m. Test 8 nh?m x?c nh?n t?ng list query kh?ng qu? 7 SQL statements. Snapshot activity ??m cho c? nh?m trong m?t query; c?p nh?t version l? m?t bulk update. Kh?ng refetch to?n b? danh s?ch theo m?i tin hay mark-read. Kh?ng th?m th? vi?n, Redis/Kafka, localStorage read-state ho?c h? t?ng m?i.

## Validation th?c t?

- npm.cmd run build: PASS, g?m tsc -b v? Vite production build.
- npm.cmd test -- --reporter=dot: PASS, 123 tests / 15 files.
- Maven Wrapper test v?i Java 21: PASS, 85 tests, 0 failures/errors/skips.
- git diff --check: PASS.
- Kh?ng c? script lint ho?c typecheck ri?ng; build ?? ch?y TypeScript.

Backend tests m?i ki?m tra DIRECT/GROUP unread, t? g?i ???c lo?i tr?, state ri?ng t?ng ng??i, idempotence, monotonicity, timestamp ties, ID cao nh?ng timestamp c?, cursor ph?n trang, authorization/cursor sai, nh?m b? x?a/th?nh vi?n b? lo?i, unread sau tin m?i, cursor ??ng th?i v? multi-tab WebSocket. Test socket d?ng hai t?i kho?n v? hai session c?a ng??i ??c, x?c nh?n ??i ph??ng kh?ng nh?n read event.

Web tests m?i ki?m tra badge/zero/99+, filter/search/sorting, tr?ng th?i read th?nh c?ng, failure v? retry an to?n, tab hidden/unfocused, pane ngo?i viewport, ??c tin c? khi c? tin m?i, cleanup v? ph?n h?i tr?, duplicate/out-of-order snapshots, membership m?i, reconnect v? panel/scroll ?n ??nh sau khi row b? l?c kh?i Unread. C?c test regression s?n c? cho authentication, friends, Search/Nearby, quota 5 tin m?i ng??i, k?t b?n trong chat, DIRECT/GROUP, group management/deletion, notification v? logout ti?p t?c pass.

## Ki?m ch?ng th? c?ng v? gi?i h?n

Kh?ng th?c hi?n k?ch b?n A?F th? c?ng tr?n tr?nh duy?t th?t; kh?ng c? browser automation tool trong phi?n n?y. C?c k?ch b?n li?n quan ???c ki?m tra t? ??ng b?ng JSDOM ho?c server WebSocket th?t. JSDOM d?ng geometry ???c ki?m so?t n?n kh?ng thay th? ki?m tra layout responsive, scroll physics v? b?n ph?m tr?nh duy?t th?t.

Docker daemon kh?ng ch?y (docker ps kh?ng k?t n?i ???c Docker Desktop Linux Engine), n?n ch?a ch?y Flyway V12 ho?c query tr?n PostgreSQL/PostGIS. Backend integration tests d?ng H2 profile hi?n c? v?i schema do Hibernate t?o. SQL migration PostgreSQL ?? ???c r? so?t, nh?ng ch?a ???c ch?y th?c t? trong phi?n.

Cursor l? ranh gi?i tu?n t?: khi xem message m?i nh?t, c?c message tr??c n? ???c xem l? ?? ??c theo boundary. Kh?ng c? tracking ??c l?p t?ng bubble ho?c b?ng ch?ng ng??i d?ng ?? ??c n?i dung. Khi mark-read l?i, badge c? th? c?n unread ??n t??ng t?c ho?c reconciliation ti?p theo.

Kh?ng tri?n khai c?c m?c ngo?i scope: participant-visible read receipts, delivery receipts, typing, reactions, edit/delete, forwarding, media, pinned/archive ho?c push infrastructure. Mobile kh?ng b? s?a; kh?ng ch?y Mobile build/typecheck/test. Physical-device checks ???c b? qua v? kh?ng c? thi?t b? th?t.

## ??nh gi? acceptance v? PROMPT_031

C?c acceptance criteria v? DIRECT/GROUP, own-message exclusion, persisted state, UI/filter/search/order, authorization/idempotence/monotonicity, hidden/older-message behavior, duplicate/reconnect, switching/regression, tests/build v? Mobile preservation ??u ?? ???c tri?n khai v? ki?m ch?ng t? ??ng. Ch?a manual verification nh? n?u tr?n; kh?ng c? acceptance feature n?o b? b? l?i.

?? xu?t PROMPT_031: t?ng unread ? menu Messages v? b? E2E tr?nh duy?t ?a tab/viewport v?i PostgreSQL/PostGIS, gi? scope Web-first v? kh?ng th?m read receipts cho ??i ph??ng.

PROMPT_030 COMPLETE
