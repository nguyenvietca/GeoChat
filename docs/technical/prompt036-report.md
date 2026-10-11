# Báo cáo PROMPT_036 — Nearby Discovery & Map UX

## 1. Kiến trúc Nearby hiện có

Nearby trước đây có danh sách, chọn radius, một lần lấy GPS rồi POST `/api/v1/locations/me`, GET `/locations/nearby`, friendship APIs và mở DIRECT/contextual chat. Chưa có map/discoverability/public profile route. `user_locations` lưu latitude/longitude và updated_at; V3 có generated geography(Point,4326), GiST index. PostgreSQL dùng ST_DWithin/ST_Distance, H2 có fallback cho tests. Response Nearby cũ không có tọa độ nhưng trả khoảng cách chính xác, nên repeated location/radius queries có nguy cơ dò vị trí.

PROMPT_034/035 đã có Reply/Reactions/actions/images và được giữ nguyên. PROMPT_036 hiện tại thay thế đề xuất Message Search; không triển khai Message Search.

## 2. Các chức năng tái sử dụng

JWT/security, location update, PostGIS, friend/request APIs, direct/contextual conversation workflows, AuthContext, profile page/route family, initials avatar và theme tokens. Không có map library trước đây; bổ sung Leaflet 1.9.4 + types. Không thêm microservice, Redis hoặc dịch vụ trả phí.

## 3. Backend mới

- GET/PUT `/api/v1/locations/discoverability` đọc/lưu choice của principal, độc lập GPS permission.
- Nearby thêm optional page 0–4, giữ radius/limit và response items/radiusMeters cũ; thêm page/hasMore và mapArea.
- Public profile GET `/api/v1/users/{userId}/profile` trả UserSummaryResponse: userId/username/displayName của ACTIVE user, cùng loại thông tin đã có ở public user search. Không trả timestamp/password/location hoặc private profile fields.
- Freshness 24 giờ cho requester và target; ACTIVE, opt-in và loại chính mình ở database query.
- Validate finite radius/coordinates, giới hạn radius cũ 100 km, page size tối đa 100 và tối đa 5 pages.
- Process-local guard: 20 search/contextual-radius checks mỗi phút/user, 10 location updates/phút; tối đa 10.000 window entries, hết hạn sau một phút. Lỗi 429 có thông báo dễ hiểu.

## 4. Migration

V15 `backend/src/main/resources/db/migration/V15__nearby_privacy.sql`: `users.nearby_discoverable BOOLEAN NOT NULL DEFAULT FALSE`, không tự bật cho tài khoản cũ; generated geography `user_locations.discovery_area` từ cell centers cố định 0,05 độ và GiST index riêng. Tái sử dụng updated_at; không thêm location history hoặc bảng mới. Không sửa applied migrations.

V15 đã chạy validation trong schema tạm PostgreSQL/PostGIS rồi rollback, chưa áp dụng lên database ứng dụng đang hoạt động.

## 5. Chiến lược PostGIS

Query production dùng ST_DWithin trên **discovery_area geography** đã index và ST_Distance geography theo meters. Filter opt-in/status/freshness trước ordering/limit/offset; tie-break user ID để pagination ổn định. H2 tests dùng cùng cell model với spherical fallback, không dùng để tuyên bố đã kiểm tra PostGIS.

PostgresNearbyPrivacyTest thực thi **SQL production dùng chung** trên PostgreSQL/PostGIS: migration defaults, visibility on/off, same-cell repeated updates cho kết quả không đổi, đổi cell, radius 1/10 km, stale exclusion và GiST index. DDL/data trong transaction/schema cô lập, không sửa application data.

## 6. Privacy model

Không trả vị trí thật của người khác. Target và search center đều ánh xạ vào cell cố định 0,05 độ; map chỉ trả center/key của cell. Khoảng cách và radius matching cũng dùng cell centers, không dùng khoảng cách thật rồi chỉ “jitter” marker. distanceMeters trả band floor theo km; field/type cũ giữ nguyên nhưng semantics giờ approximate.

Điều này loại oracle khoảng cách chính xác trong Nearby. Contextual chat cũng dùng cùng cell/opt-in/freshness model, tránh bypass qua hỏi radius ở endpoint chat. Một người có thể biết cell được công bố, không suy ra vị trí bên trong cell bằng thay radius/center. Không có per-request jitter, GPS polling hoặc tọa độ trong localStorage. GPS của chính người xem chỉ giữ trong component và gửi qua update API theo thao tác rõ ràng.

Đổi lại, radius là khoảng cách giữa **approximate areas**, không phải GPS chính xác: người gần nhau ở hai cell cạnh nhau có thể không match radius nhỏ. Cell khoảng 5,5 km theo latitude, longitude width thay đổi theo vĩ độ; không phải k-anonymity/differential privacy. Ngoài thông tin có sẵn vẫn có thể suy luận vùng nhạy cảm; không tuyên bố chống mọi tracking. Không có blocking model hiện tại, không tự xây blocking system.

## 7. Bản đồ

Leaflet quản lý zoom/pan, own-location marker khác màu và aggregate area markers đếm người trong results đã load. Chọn card highlight area; chọn area select một card thuộc area và có selected-person feedback/profile link. Fit areas không đổi radius/refetch. Map instance giữ nguyên khi filter/view đổi, ResizeObserver invalidate size; cleanup map/observer khi unmount. Cập nhật GPS rõ ràng cập nhật own marker; không liên tục recenter khi chọn card. Animations tắt.

Default tiles là `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, có attribution OpenStreetMap; dùng cache/referrer bình thường, không prefetch/offline downloads. `VITE_NEARBY_TILE_URL`/`VITE_NEARBY_TILE_ATTRIBUTION` cho provider deployment. Public OSM community tiles chỉ phù hợp lưu lượng nhẹ/dev; production cần provider phù hợp và tuân thủ [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/). Reference API: [Leaflet 1.9.4](https://leafletjs.com/reference-1.9.4.html).

Tile provider có thể thấy viewed tile areas/IP; không gửi user IDs, profile payload hoặc raw other-user coordinates cho provider. Khi tile lỗi, list và markers vẫn dùng được, có feedback. Browser checks chặn tile requests để không tải community server trong test.

## 8. Nearby UI

Desktop split khoảng 35/65 list/map, tablet split, browser hẹp có List/Map toggle. Giữ selection/filter/data khi toggle, không reload. Radius options tập trung: 1/3/5/10/25 km, default 5 km; đổi radius tự refresh khi đã có GPS, không prompt lại. Generation guard loại responses cũ, unmount bỏ callbacks; radius ref đảm bảo lựa chọn đổi trong lúc chờ GPS được dùng khi search.

Cards: initials, display name, approximate distance, relationship label và actions. Không có exact distance/address/coordinates, fabricated online hoặc visible internal IDs. Discovery default off, checkbox lưu backend, giải thích permission/visibility riêng và freshness. States gồm GPS chưa xin/denied/timeout/unavailable/unsupported, empty, network/backend error, refresh loading, pending social action. Request position chỉ khi “Use my location” hoặc “Update location”, không watchPosition/timer.

## 9. Friend/profile/chat

Friend/incoming/outgoing list APIs xác định relationship theo batch, không query mỗi card. Add friend cập nhật card ngay; incoming request nhận trực tiếp bằng accept API; outgoing có Manage request link. Friends mở DIRECT API tái sử dụng conversation; non-friend contextual messaging đã được hỗ trợ trước prompt và vẫn theo authorization/privacy checks hiện tại. Không thêm friendship semantics hoặc bypass quota.

Profile navigation dùng route `/app/profile/:userId` trong ProfilePage hiện có; own-profile route/editor giữ nguyên. Public view chỉ render permitted name/username, back-to-Nearby và unavailable state.

## 10. Files thay đổi

- Backend: User entity/service/controller; location DTOs, controller, LocationService, NearbyRequestGuard, NearbyUserRow, search repository/interface/implementation; GlobalExceptionHandler; migration V15.
- Tests Backend: LocationIntegrationTest, ChatIntegrationTest opt-in fixtures, PostgresNearbyPrivacyTest.
- Web: package.json/lock (Leaflet/types), App/route/tests, location/users API, types, NearbyPage, NearbyMap, nearbyPresentation, ProfilePage, styles.css, tile config `.env.example`.
- Browser harness: `apps/web/scripts/check-responsive.mjs`; report này.
- `AI_promt/prompt_036.md` là yêu cầu được user cập nhật trước khi thực hiện; không ghi đè thay đổi đó. Mobile không thay đổi.

## 11. Backend results

Java 21, Maven Wrapper, `GEOCHAT_VALIDATE_POSTGRES=true`: **115 tests PASS, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS**. Bao gồm auth/friends/chat/images/reply/reaction regressions và ba PostgreSQL tests V13/V14/V15.

Lệnh: `mvnw.cmd '-DargLine=-XX:ActiveProcessorCount=2 -Xmx384m -XX:TieredStopAtLevel=1 -XX:ReservedCodeCacheSize=64m' test`, Maven heap 192m. Lượt chạy song song trước đó bị native-memory exhaustion; validation cuối chạy tuần tự sau khi tắt browser/Vite. Không bỏ test hoặc làm yếu acceptance để né lỗi môi trường.

Location tests: default off, disable, same-cell repeated queries, freshness/inactive, bounded pagination, radius/coordinate validation, JWT visibility/profile, public fields, own-user exclusion, no raw response coordinates; contextual chat regression đã opt-in explicit fixtures.

## 12. Web results

`npm.cmd test -- --maxWorkers=1 --reporter=dot`: **18 files, 162 tests PASS**. `npm.cmd run build`: **PASS**, TypeScript + Vite. Không có lint script riêng; `git diff --check` đạt.

New tests kiểm tra visibility tách GPS, map/list giữ selection và không refetch, marker/card callback, stale radius response, accept incoming và public profile navigation; các tests GPS errors/unsupported/network/empty/social/chat trước đây tiếp tục đạt. Browser checks dùng Leaflet thật, không chỉ map mock của unit tests.

## 13. Xác minh thực sự thực hiện

Edge headless Light/Dark tại 375/768/1440 px: **6 cases PASS**; list/map, card/area selection, controls/overflow/navigation, mobile map toggle và long display name. Đã xem screenshot. Artifacts: `apps/web/build/prompt036/nearby-light` và `nearby-dark`.

Browser dùng fixtures chỉ cho validation UI. Không tuyên bố đã thao tác manual nhiều tài khoản thật trong browser. Hai test accounts với location explicit được kiểm tra bằng Spring integration; PostGIS thật được kiểm tra bằng schema rollback với Viewer/Target, opt-in/off, radius và repeated updates. Không có thiết bị thật, physical-device checks skipped.

## 14. Regression và compatibility

Full Web/Backend suites đạt: authentication/logout/friends/profile, DIRECT/GROUP, group deletion, text/images, unread/read, typing/presence, reply/reaction/actions, notification/theme/navigation paths hiện có. Không triển khai Message Search.

Mobile source chỉ đọc locationApi/types; endpoint/request và userId/displayName/distanceMeters/items/radiusMeters giữ kiểu cũ, field mới additive. **Behavioral change cần lưu ý:** distance nay approximate, stale/opted-out users không hiện, contextual Nearby matching theo cell. Mobile cũ chưa có visibility UI; phải opt-in qua Web để xuất hiện. Đây là safe-default privacy behavior được yêu cầu, không tự enable legacy users. Không chạy Mobile build/typecheck/test.

## 15. Giới hạn

Process-local rate limit không phối hợp nhiều instance/không chống Sybil; reset khi process restart. Offset pagination có thể dịch chuyển khi visibility/location đổi giữa pages; cap tối đa 500 results. Area counts chỉ đếm results đã load, không phải toàn bộ dân số/cell. Cell model có boundary/high-latitude tradeoffs và không bảo đảm anonymity. Vị trí mới nhất 24h không chứng minh presence thật tại thời điểm xem.

Chưa manual multi-account browser/mạng thật, chưa production tile capacity/provider deployment, chưa apply V15 lên database ứng dụng. Không thêm blocking/background tracking/address/online claims, map service trả phí hoặc Native Mobile UX.

## 16. Milestone đề nghị

Chốt production tile provider, đo spatial query/rate behavior với dữ liệu thực tế và kiểm tra end-to-end nhiều account trước phát hành. Milestone tiếp theo cần yêu cầu riêng; không tự triển khai lại Message Search đã bị thay thế.

Đã triển khai và kiểm thử tự động: discovery real API/query, visibility/freshness/privacy/rate bounds, map/list/social/profile/chat, responsive/themes và regression. Đã triển khai nhưng chưa manual: browser nhiều tài khoản server thật. Chưa triển khai: các chức năng ngoài scope tại mục 15.

PROMPT_036 COMPLETE
