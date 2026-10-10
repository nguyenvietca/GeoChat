# Báo cáo PROMPT_031 — UI/UX và responsive Web

## Kết quả

Đã hoàn thành polish Web, kiểm thử regression và kiểm tra layout bằng Edge headless tại 375, 768, 1024 và 1440px. Backend, Mobile, routes, REST APIs và WebSocket architecture không thay đổi.

## Vấn đề đã xác định

- Search input mất outline mà không có focus indicator thay thế cho form.
- Preview/timestamp nhỏ, metadata nhạt; font/focus của textarea chưa thống nhất.
- Header nhóm ở 375px ép tên xuống vài ký tự vì quá nhiều phần tử trên một hàng. Đã xác nhận bằng ảnh baseline.
- Nhiều nút/menu trên browser mobile chỉ cao 34–36px.
- Rule `.side-nav` ghi đè `display:none` của `.account-side-nav`, làm menu Account xuất hiện thêm dưới bottom navigation. Đã phát hiện và xác nhận sửa bằng ảnh.
- Chat có min-height 400px trên mobile, không phù hợp khi vùng hiển thị thu nhỏ; header DIRECT/GROUP cần cùng kích thước.
- Enter chưa guard IME composition; JavaScript smooth-scroll chưa tôn trọng reduced motion.
- Profile thiếu liên kết lỗi với input và Cancel cho draft; Settings mô tả token/realtime thay vì kết quả người dùng quan tâm.

## Cải thiện đã triển khai

Giữ màu GeoChat, bổ sung/reuse token surface-muted, hover-surface, active-surface, radius-control, radius-panel, space-page, focus-ring và mobile-nav-height. Metadata dễ đọc hơn; spacing, controls, state blocks và card Profile/Settings thống nhất. Không thay framework CSS hoặc viết lại toàn stylesheet.

Navigation có Skip to content, main focus target và aria-hidden cho icon trang trí. Nhãn menu **Search** được sửa song song trong workspace được giữ nguyên; test navigation đã cập nhật theo nhãn hiện tại.

Messages giữ search, All/Unread, sorting, badge, titleHint và scrollbar-gutter. Sidebar có hover/focus rõ, tên dài được truncate; header dùng grid và tách metadata/action trên mobile. DIRECT/GROUP có cùng chiều cao header tại mỗi viewport đã đo. Bubbles dễ đọc hơn, giữ multiline, long URL và sender nhóm. Composer có font/focus/disabled rõ; IME không gửi nhầm, Enter/Shift+Enter giữ nguyên. Khi reduced motion bật, auto-scroll và Jump to latest dùng `behavior:auto`.

Friends/Nearby/Search được review và cải thiện qua shared CSS: list/actions wrap, tên dài không đẩy layout, touch targets phù hợp. Không thay friendship logic, location flow hoặc xin thêm permission. Loading/empty/error blocks được căn chỉnh và có nút thử lại dễ chạm.

Notifications giữ logic unread/timestamp/API; title/message dài wrap, unread có accent và typography rõ hơn, actions thích ứng màn hình hẹp. Profile/Settings được nhóm thành card. Profile có hướng dẫn 2–100 ký tự, aria-invalid/aria-describedby và Cancel khôi phục tên đã lưu mà không gọi API. Feedback cũ được xóa khi bắt đầu sửa draft mới. Settings giữ logout behavior và dùng copy hướng đến người dùng.

## Files thay đổi

- `apps/web/src/styles.css`
- `apps/web/src/App.tsx` và `App.test.tsx`
- `apps/web/src/features/chat/ChatPanel.tsx` và `MessagesPage.test.tsx`
- `apps/web/src/features/friends/FriendsChat.test.tsx`: selector khớp nhãn Search hiện tại
- `apps/web/src/features/profile/ProfilePage.tsx`
- `apps/web/src/features/settings/SettingsPage.tsx`
- `apps/web/scripts/check-responsive.mjs` (mới): công cụ CDP không thêm dependency
- `docs/technical/prompt031-report.md` (báo cáo này)

`AI_promt/prompt_031.md` được đọc và giữ nguyên. Không tạo component library mới vì các component/state patterns hiện có đã đủ.

## Responsive và accessibility

Giữ desktop 40/60 và điều hướng list/chat ở breakpoint hiện có. Small desktop giảm khoảng trống shell. Mobile dùng touch targets 44px, field font 16px, action wrapping và bottom navigation có safe-area. Chat dùng dvh và bỏ min-height cố định để composer có chỗ khi viewport nhỏ; lỗi/limit có giới hạn chiều cao và scroll riêng.

Search có focus-within ring; button/input/textarea giữ keyboard focus. Unread vẫn có badge/label, không chỉ phân biệt bằng màu. Profile error gắn với field; Cancel không submit. Reduced motion được xử lý ở cả CSS và JavaScript scrollTo.

## Build, tests và regression

- `npm.cmd run build`: PASS, gồm `tsc -b` và Vite production build.
- `npm.cmd test -- --reporter=dot`: PASS, **126 tests / 15 files**.
- `git diff --check`: PASS.
- Không có script lint/typecheck riêng; build đã kiểm tra TypeScript.
- Không chạy lại Backend tests vì không sửa Backend.

Ba test mới xác nhận IME/Shift+Enter không gửi nhầm, reduced-motion cho scrolling và Cancel/validation accessibility của Profile. Các test sẵn có về auth, friends, Search/Nearby, DIRECT/GROUP, quota riêng 5 tin, kết bạn trong chat, group management/delete, search/sorting/previews/timestamps, sending/deduplication, smart scrolling, socket cleanup, unread/filter/read boundary/reconnect, notifications, Profile/Settings và logout tiếp tục pass.

Một lượt giữa chừng có 5 test fail vì menu đổi từ Search people thành Search. Đã cập nhật selector; lượt cuối toàn bộ 126 test pass.

## Kiểm tra trình duyệt và ảnh thực tế

Edge headless chạy với profile riêng, Vite local và API/notification/geolocation/WebSocket fixtures. Không dùng tài khoản hoặc Backend thật; không xin location permission thật. Google Fonts bị chặn trong lượt xác nhận để dùng font fallback và tránh phụ thuộc mạng.

| Lượt kiểm tra | Phạm vi | Kết quả |
| --- | --- | --- |
| verified | 45 trang/trạng thái: Home, Messages, DIRECT/GROUP, Friends, Nearby, Search, Notifications, Profile, Settings ở 4 viewport; thêm empty/loading/error ở 375px | Không overflow, control ngoài viewport/đè nhau, navigation không dùng được hoặc composer bị che trong fixtures |
| forms | 16 kiểm tra Login/Register, Create group và Group info ở 4 viewport; chạy lại sau tăng touch target | Không lỗi layout đo được |
| headers | 8 kiểm tra DIRECT/GROUP sau chỉnh kích thước cuối | Cả hai header đều 115px ở 375px và 74px ở 768/1024/1440px; composer hiển thị |
| keyboard | 2 kiểm tra DIRECT/GROUP ở 375×450 sau chỉnh header cuối | Composer vẫn trên bottom navigation, không overflow/overlap |

Đã mở và xem ảnh baseline chat nhóm 375px; ảnh chat ở 375/768/1024/1440px, Profile 375px, Group info 375px và viewport thu nhỏ. Baseline đầu tiên timeout một lần capture giữa chừng; kết quả dở dang không được tính là pass. Các lượt xác nhận sau lưu results.json/PNG theo từng trang và hoàn tất.

Artifacts được gitignore trong `apps/web/build/prompt031/{verified,forms,headers,keyboard}`. Mỗi thư mục có `results.json` và PNG.

Chạy lại: mở Vite bằng `npm.cmd run dev -- --host 127.0.0.1 --port 5179`, rồi `node scripts/check-responsive.mjs verified` (hoặc forms/headers/keyboard). Script dùng Edge cài tại đường dẫn Windows mặc định và Node có WebSocket tích hợp. Nếu phát hiện lỗi layout, script trả exit code khác 0.

## Hiệu năng và giới hạn

Phần lớn thay đổi là CSS; không thêm fetch/effect/subscription cho polish. Không đụng MessagesPage load dependencies, unread/read-state protocol, pagination hoặc socket lifecycle. IME dùng ref; Profile Cancel là state local. Script browser validation không nằm trong bundle production.

**Đã triển khai và kiểm thử:** các thay đổi nêu trên, regression và responsive fixtures ở bốn viewport. **Chưa kiểm chứng:** Webfonts từ CDN, Backend thật, IME hệ điều hành hoặc bàn phím thiết bị thật. 375×450 là mô phỏng vùng hiển thị nhỏ, không phải thao tác mở bàn phím thật. Physical-device checks được bỏ qua vì không có thiết bị thật. Không khẳng định các locale/trình duyệt/dữ liệu chưa chạy đều đã được kiểm chứng.

**Không triển khai:** tính năng ngoài scope. Backend và Mobile không bị sửa; không chạy Mobile build/typecheck/test.

## Đề xuất PROMPT_032

E2E trên Web + Backend thật cho Search → chat giới hạn → kết bạn → chat bình thường, unread nhiều tab và keyboard/viewport; thêm kiểm chứng accessibility với screen reader. Giữ scope Web-first, không thêm Mobile hoặc read receipts.

PROMPT_031 COMPLETE
