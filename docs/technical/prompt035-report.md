# Báo cáo PROMPT_035

Ngày kiểm tra: 11/10/2026.

## 1. Audit kiến trúc ban đầu

PROMPT_034 đã hiện diện: Message có ID Long, conversationId, senderId, content, createdAt, reply reference và reaction version; reply/reaction UI và API đang hoạt động. ChatService quản lý membership, quota, pagination, read-state và activity. Persisted message dùng `/topic/chat/{conversationId}`; typing/reaction dùng topic riêng. Không có upload endpoint, attachment entity hoặc storage service trước milestone này.

SecurityConfig yêu cầu JWT cho API mới theo quy tắc hiện có. GroupService hard-delete messages trong transaction với conversation lock. Web ChatPanel keyed theo conversation, có sending guard, smart scroll, IME và object lifecycle theo component. Mobile decoder kiểm tra các field message cũ, không reject field bổ sung.

## 2. Storage và workflow

Chọn **một bước upload + tạo message**, thay vì upload tạm rồi claim. Local preview chỉ ở browser; khi bấm Send, multipart request gửi ảnh/caption/reply reference/requestId. Backend xác thực membership, validate/re-encode, ghi file và bind metadata trong transaction tạo message. Khóa request UUID chống gửi trùng khi response bị mất. Text-only endpoint giữ nguyên.

File nằm dưới root cấu hình, tên UUID nội bộ, không dùng filename người gửi làm path. Không có public static mapping. JPEG được re-encode JPEG; PNG/WebP được normalize thành PNG và bỏ metadata. Plugin `imageio-webp:3.15.0` chỉ phục vụ ImageIO decoding WebP; chọn bản có các sửa validation/decoding theo [release notes chính thức](https://github.com/haraldk/TwelveMonkeys/releases/tag/twelvemonkeys-3.15.0). Không thêm cloud storage hoặc framework xử lý ảnh lớn.

## 3. Migration

V14 `backend/src/main/resources/db/migration/V14__add_message_images.sql` tạo `message_attachments`: message/conversation/uploader, request UUID, storage key, original filename, content type, size, width/height và createdAt. Unique message_id đảm bảo một ảnh/message; unique request_id/storage_key chống reuse/duplicate. FK messages/conversations cascade metadata khi hard-delete; index conversation hỗ trợ cleanup. Không sửa migration cũ, không lưu binary/base64 vào PostgreSQL và không thay ordering/ID messages.

## 4. Upload API

POST `/api/v1/chats/{conversationId}/images`, multipart fields:

- `image`: một JPEG/PNG/WebP tối đa 5 MiB.
- `content`: caption tùy chọn, tối đa 5000 ký tự.
- `replyToMessageId`: tùy chọn, kiểm tra cùng conversation.
- `requestId`: UUID theo lần chọn ảnh, giữ nguyên khi retry.

Trả ApiResponse<MessageResponse>. Endpoint text-only và send request cũ giữ nguyên. Completely empty text request vẫn bị reject; image-only có content là chuỗi rỗng. Duplicate request cùng user/conversation/payload trả message đã tạo, không tạo activity/unread lần hai. Retry đổi caption/reply sau khi request đã thành công bị reject rõ ràng để tránh âm thầm trả payload khác. Không cho user khác sử dụng requestId của người gửi.

## 5. Tải ảnh và authorization

GET `/api/v1/chats/images/{attachmentId}` yêu cầu JWT. Backend kiểm tra current membership trước đọc file, trả cùng thông báo 404 “Image unavailable” cho ID không tồn tại hoặc user không được quyền. Former group members và deleted groups không tải được ảnh. Response dùng content type đã normalize, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, không chứa storage key/path.

Web gửi token trong Authorization header; không đưa JWT vào URL. Blob URL chỉ tồn tại trong component, dùng chung thumbnail/viewer và revoke trên cleanup/logout/switch.

## 6. Message integration

MessageResponse thêm attachment nullable `{attachmentId,contentType,sizeBytes,width,height}`; giữ mọi required fields và reply/reaction fields. Metadata được batch theo message IDs của page; không N+1. REST history và WebSocket topic cũ đều nhận metadata, không binary.

Conversation preview là `Photo` hoặc `Photo: caption`, dùng một batch query cho latest messages, bỏ query nếu không có latest IDs. Web live preview dùng cùng convention. Message dedup bằng ID, unread/read cursor, quota mỗi người và activity pipeline cũ được tái sử dụng. Reaction/Reply tiếp tục làm việc với ảnh; image-only reply preview là “Photo”, không hiện Copy text nếu không có caption.

## 7. Web UI

Composer thêm icon ảnh và native picker; accept JPEG/PNG/WebP, validate type/size client. Preview có thumbnail, filename, “Not sent yet”, Remove; chọn/xóa ảnh giữ text draft. Chỉ upload khi Send. Trạng thái indeterminate “Uploading and sending...” dùng request thật, không giả phần trăm. Busy guard và UUID retry tránh submit trùng; selection/draft giữ khi lỗi phục hồi được.

ChatImage tải bytes bằng JWT, lazy-load bằng IntersectionObserver khi gần viewport, reserve aspect ratio và giới hạn thumbnail. Có loading/unavailable/retry. Viewer modal dùng cùng object URL, close/Escape/outside, focus trap/restoration và theme tokens. Conversation switch abort request và revoke preview; late response không tác động chat mới. Enter/Shift+Enter/IME logic hiện có được giữ.

## 8. Files thay đổi

- Backend mới: `controller/ChatImageController.java`, `entity/MessageAttachment.java`, `repository/MessageAttachmentRepository.java`, `service/ImageStorage.java`, `service/ImageCleanup.java`, `event/ChatImagesDeletedEvent.java` dưới `backend/src/main/java/com/geochat/chat`.
- Backend tích hợp: `chat/service/ChatService.java`, `chat/service/GroupService.java`, `chat/dto/ChatDtos.java`, `common/exception/GlobalExceptionHandler.java`.
- Config: `backend/pom.xml`, application.yml/application-test.yml, migration V14, `.env.example`, `.gitignore`.
- Backend tests: ImageSharingIntegrationTest, PostgresImageMigrationTest, ChatWebSocketIntegrationTest và WebP fixture dưới `backend/src/test`.
- Web mới: `apps/web/src/api/images.ts`, `features/chat/ChatImage.tsx`, `features/chat/ChatImage.test.tsx`.
- Web tích hợp: api/client.ts và test, types/index.ts, ChatPanel.tsx, MessageActions.tsx, MessagesPage.test.tsx, messagePresentation.ts, styles.css, browser harness `apps/web/scripts/check-responsive.mjs`.
- Tài liệu: báo cáo này. Không triển khai PROMPT_036 trong milestone này.

## 9. Security/resource limits

Server enforce raw size và normalized size tối đa 5 MiB; multipart 5 MB/file, 6 MB/request. MIME phải thuộc allowlist và khớp format ImageIO đọc được; reject empty, unsupported, forged MIME, invalid bytes và animated WebP. Decode kiểm tra chiều tối đa 4096 px, tối đa 12 megapixels trước đọc buffer. Decode serialized trong storage instance để hạn chế đồng thời nhiều buffer ảnh lớn.

Re-encode ảnh thành JPEG/PNG loại bỏ metadata/trailing executable content. Generated key chỉ được resolve theo pattern cố định trong root, reject traversal/absolute path/symlink. Không trả nguyên filename/header tùy ý của user làm content-disposition. Không có SVG/HTML/GIF/general files và không expose storage root.

## 10. Cleanup và cấu hình vận hành

Rollback database xóa file đã ghi; trạng thái transaction không xác định không xóa ngay, để orphan sweep xử lý. Group deletion snapshot keys trước cascade, xóa physical files sau commit qua event. Cleanup failure được log chung và retry bằng sweep, không fail transaction đã commit. Orphan sweep mỗi giờ xóa generated files không còn metadata và cũ hơn một giờ; bỏ recent files và attached files. Tests xác minh rollback, group cleanup và sweep không xóa ảnh đã bind.

**Không có temporary-upload identifier/claim endpoint**, vì workflow một bước không tạo upload chưa gắn message. Không cần expiration/claim ownership cho resource tạm. File mồ côi do crash/partial failure được xử lý bằng grace + sweep nêu trên.

`GEOCHAT_IMAGE_STORAGE` tương ứng `geochat.upload.storage-path`; mặc định `./var/chat-images` tính từ working directory backend. Nên dùng absolute path khi chạy service. `GEOCHAT_MAX_IMAGE_SIZE` chỉ có thể giảm giới hạn 5 MiB; `GEOCHAT_IMAGE_TYPES` thu hẹp allowlist. Storage mặc định và test/build artifacts được Git ignore.

Docker hiện chỉ có PostGIS, không cần thay compose. Khi containerize Backend, cấu hình ví dụ `GEOCHAT_IMAGE_STORAGE=/var/lib/geochat/chat-images`, mount persistent volume riêng tại đó và cấp quyền write cho service user. Database local theo setup hiện có: `docker compose up -d postgres`. Backup cần gồm database và thư mục ảnh; chưa thêm infrastructure/backup automation.

## 11. Backend validation

Java 21, Maven Wrapper. Target cũ có file bị khóa nên dùng temporary POM với cùng source/dependencies/test config và build output `build/prompt035-backend`; temporary POM được bỏ sau validation. JVM giới hạn CPU/heap để tránh native-memory exhaustion của môi trường.

Lệnh validation tương đương `mvnw.cmd test`, thêm argLine `-XX:ActiveProcessorCount=2 -Xmx512m -XX:ReservedCodeCacheSize=96m` và bật `GEOCHAT_VALIDATE_POSTGRES=true`. **111 tests PASS, 0 failures, 0 errors, 0 skipped**; bao gồm PostgreSQL V13/V14 tests thật trong schema cô lập có rollback.

Image suite kiểm tra JPEG/PNG/WebP, image-only/caption/reply/reaction, ownership, duplicate/concurrent retry, validation/dimensions, safe metadata, authenticated retrieval/history/sidebar, group removal/delete, file rollback và orphan sweep. STOMP integration kiểm tra DIRECT/GROUP image message đến topic cũ và tồn tại trong history. Các lượt trước có regression empty-conversation preview đã sửa null handling; query-count regression cũ vẫn đạt.

## 12. Web validation

`npm.cmd test -- --maxWorkers=1 --reporter=dot`: **18 files, 158 tests PASS**. `npm.cmd run build`: **PASS**, gồm TypeScript và Vite production build. Không có lint script riêng. `git diff --check` đạt.

Tests mới: selection/remove/draft, invalid/oversize, image-only/caption send, preserved selection/idempotent retry, pending upload switch/abort/revoke, private loading/viewer/Escape/focus, failed loading/retry/late response, FormData boundary và JWT header/no token URL.

## 13. Xác minh trình duyệt thực tế

Edge headless, 375/768/1440 px, DIRECT/GROUP cho Light/Dark: **12 trường hợp PASS** cho thumbnail, selected preview, composer, viewer, geometry/no overflow. Đã xem screenshot preview/viewer. Artifacts ở `apps/web/build/prompt035/images-light` và `images-dark`.

Browser dùng API fixtures để kiểm tra UI, không tuyên bố manual nhiều tài khoản thật trong browser. Luồng nhiều tài khoản server thật được kiểm tra bằng JWT/REST/STOMP integration tests. Không có physical device nên bỏ qua kiểm tra thiết bị thật; không chạy Native Mobile.

## 14. Regression

Full suites gồm authentication/friends, DIRECT/GROUP text, management/delete, pagination/order/dedup, unread/read, typing/presence, reply/reactions/actions, theme/search/sorting/notification paths hiện có. Query-count test cho nhiều empty groups giữ bound cũ. Image message dùng cùng row `data-message-id` và same timeline. Image viewer có aria-modal nên read hook hiện có không đánh dấu tin trong khi modal mở. Response bị mất có thể retry cùng UUID mà không tăng message/unread lần hai.

## 15. Mobile compatibility

Không sửa Mobile, không chạy Mobile build/typecheck/test. Required fields/ID/time/REST message endpoints/STOMP message topic/auth giữ nguyên. Decoder đã xem chấp nhận attachment field bổ sung và content string rỗng. Mobile cũ chưa render ảnh nên image-only message có thể là bubble không có text; đây là giới hạn hiển thị của client đang hold, không thay decoder để thực hiện UI mới. Text/caption vẫn giữ kiểu string hiện có.

## 16. Giới hạn

Local single-instance storage, chưa cloud/CDN/distributed cleanup. Decode giới hạn buffer nhưng chưa worker sandbox riêng hay server upload rate-limit. EXIF/ICC metadata bị bỏ; chưa xử lý EXIF orientation riêng. WebP normalize PNG có thể bị reject nếu output vượt 5 MiB. Cleanup crash/failed deletion có thể giữ file mồ côi đến lượt sweep sau; file không có metadata không truy cập qua API.

PostgreSQL migration test kiểm tra V14 trên schema tối thiểu cô lập; chưa deploy migration vào application database. Chưa manual multi-account browser/mạng thật hoặc physical device. Không triển khai upload tạm, general files, GIF/video/audio, galleries/editor hoặc Mobile image UI.

## 17. Gợi ý PROMPT_036

Theo yêu cầu hiện có, milestone tiếp theo là Message Search & Conversation History Navigation: audit search/query authorization, pagination và navigation tới referenced messages, giữ image/reply/reaction metadata và read/scroll semantics. Chỉ thực hiện khi được yêu cầu; không mở rộng milestone 035.

Đã triển khai và kiểm thử tự động: upload/send/retrieve/private images, realtime DIRECT/GROUP, validation/idempotency/cleanup, UI/viewer/responsive/themes và regression. Đã triển khai nhưng chưa manual: nhiều tài khoản thật trên browser/mạng thật. Chưa triển khai: các tính năng ngoài scope nêu ở mục 16.

PROMPT_035 COMPLETE
