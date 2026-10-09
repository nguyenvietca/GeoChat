# PROMPT_028 — Web Group Management & Conversation Synchronization

## Context

GeoChat is a mobile + web social location-based chat application.

Current technology stack:
- Java 21
- Spring Boot 4.1.0
- PostgreSQL + PostGIS
- Flyway
- JWT authentication
- WebSocket/STOMP
- React + TypeScript web application
- React Native / Expo mobile application
- Modular monolith architecture

Completed milestones:
- PROMPT_025 — Group Chat Backend Foundation
- PROMPT_026 — Mobile Group Chat UI & Realtime Messaging
- PROMPT_027 — Web Group Chat + Facebook-style Messages Layout

The application already supports authentication, friends, direct messaging, group messaging, notifications, and realtime message delivery.

## Scope — Web First

**This prompt covers Backend and Web only.**

- Implement backend changes required for group management.
- Implement the corresponding Web UI and realtime synchronization.
- Keep existing Mobile functionality intact.
- Do not implement Mobile UI or Mobile-specific features.
- Do not run Mobile builds or tests as a requirement for this prompt.
- Preserve existing API compatibility wherever practical.
- Do not remove or rewrite existing Mobile code.

## Goal

Improve group management and keep group information consistent across the backend and Web application.

Implement:
1. Group information display.
2. Group renaming.
3. Adding eligible friends to a group.
4. Removing group members where permitted.
5. Leaving a group.
6. Backend authorization and data integrity.
7. Realtime synchronization of group changes.
8. Comprehensive backend and Web tests.

## 1. Inspect Before Coding

Before making changes:

1. Inspect the existing backend group implementation from PROMPT_025.
2. Inspect the Web group chat implementation from PROMPT_027.
3. Inspect the current Messages split layout and conversation list.
4. Inspect existing group, conversation, member, friend, and message models.
5. Inspect actual REST endpoints, DTOs, validation, and WebSocket/STOMP destinations.
6. Inspect existing group membership and owner authorization rules.
7. Inspect existing migrations and test conventions.
8. Check which group-management capabilities are already implemented.

Reuse existing architecture and naming conventions.

Do not invent API contracts before inspecting the actual code.

Do not duplicate existing functionality or rewrite working Direct Chat and Group Chat features.

## 2. Group Information UI

Provide a group information view accessible from an existing group conversation.

Display:
- Group name.
- Group owner.
- Member list.
- Member count.
- Current user's role, if available.

Use existing group DTOs and APIs where possible.

The UI must handle loading, empty, and error states.

Keep the interface consistent with GeoChat's existing Web design.

## 3. Rename Group

Allow the group owner to change the group name.

Requirements:
- Only the owner can rename the group.
- The name is required.
- Trim leading and trailing whitespace.
- Enforce the maximum length defined by backend validation.
- Prevent duplicate submissions.
- Show a loading state while saving.
- Display a success or error message.
- Update the group header and left conversation list after success.

The backend must enforce authorization and validation. Frontend checks are not a security boundary.

Do not add unrelated group profile customization.

## 4. Add Group Members

Allow the group owner to add existing friends to a group.

Requirements:
- Reuse existing Friends data and APIs.
- Only show eligible friends who are not already group members.
- Do not allow adding the current user again.
- Prevent duplicate memberships.
- Respect existing friendship and group-size rules.
- Prevent duplicate submissions.
- Display useful validation and error messages.

Inspect the current backend implementation first.

If member addition is not supported, implement the necessary backend endpoint, authorization, validation, persistence, and tests.

Use transactions and database constraints where appropriate.

Do not introduce public groups, invitation links, or a new friend system.

## 5. Remove Group Members

Implement member removal only if compatible with the existing product rules.

Default permission rules:
- Only the group owner may remove another member.
- The owner cannot remove themselves using the ordinary member-removal action.
- A user cannot remove arbitrary users from other groups.
- Non-members cannot manage group membership.

If existing backend rules are stricter, preserve them.

Before removing a member, show a confirmation dialog.

After successful removal:
- Refresh the member list.
- Update the conversation list and group information.
- Prevent the removed user from reading or sending protected group messages.
- Synchronize the membership change to affected connected clients.

Do not implement ownership transfer in this prompt.

## 6. Leave Group

Preserve existing Leave Group behavior.

Requirements:
- Regular members can leave when permitted by the backend.
- The owner must follow the existing owner-leave policy.
- Confirm the action before leaving.
- Refresh the conversation list after success.
- Clear the selected group if the current user leaves.
- Prevent a departed member from sending new group messages.

Do not silently change existing ownership rules.

If the backend already supports leaving a group, reuse its implementation.

## 7. Backend Authorization and Data Integrity

The backend is the source of truth for permissions.

Verify and enforce:
- Only group members can read private group information.
- Only group members can read group messages.
- Only group members can send group messages.
- Only the owner can rename a group.
- Only authorized users can add or remove members.
- Duplicate membership is prevented.
- Group-size limits are enforced, including under concurrent requests.
- Invalid group IDs return appropriate errors.
- Unauthorized requests do not expose private group information.

Use transactions for group metadata and membership changes.

Add or update database constraints and Flyway migrations only when required.

Do not weaken existing JWT, REST, or WebSocket security.

## 8. Realtime Synchronization

Extend the existing WebSocket/STOMP infrastructure only where necessary.

Synchronize relevant events:
- Group name changed.
- Member added.
- Member removed.
- Member left.

Requirements:
- Persist changes before publishing events.
- Prevent duplicate UI updates.
- Update the group header, member list, and conversation list.
- Send events only to authorized recipients.
- Revalidate access after membership changes.
- Remove obsolete subscriptions or prevent unauthorized future access where required.

Use the existing realtime event conventions if available.

If the current architecture does not support group-management events, extend it consistently rather than creating a separate realtime system.

Do not implement typing indicators, read receipts, or reactions.

## 9. Web UI Integration

Update the existing Web group conversation UI.

Provide:
- Group information access.
- Rename action for the owner.
- Add-member action for the owner.
- Remove-member actions where authorized.
- Leave-group action where supported.
- Realtime updates to group information.

Preserve the existing Messages layout from PROMPT_027:

- Left panel: approximately 40%.
- Right panel: approximately 60%.
- Conversation switching without full-page reload.

Do not regress:
- Direct Chat.
- Group Chat.
- Message history.
- WebSocket message delivery.
- Conversation switching.
- Responsive behavior.

Do not redesign the entire Web application.

## 10. API and TypeScript Contracts

Inspect actual backend DTOs and endpoints before updating the Web API client.

Requirements:
- Reuse the existing HTTP client.
- Reuse shared TypeScript types where appropriate.
- Avoid duplicated DTOs with conflicting fields.
- Avoid unnecessary `any` types.
- Handle optional fields safely.
- Use actual backend error response formats.
- Document new endpoints and realtime event contracts using the project's existing documentation conventions.

**Compatibility requirement:** Do not make unnecessary breaking API changes. Existing Mobile clients should continue to work with the updated backend unless a change is unavoidable and explicitly documented.

Do not implement any Mobile UI or Mobile-specific API integration.

## 11. Error Handling

Handle:
- Invalid group name.
- Maximum group size reached.
- User already in group.
- User does not satisfy friendship requirements.
- Group not found.
- User is not a member.
- User is not the owner.
- Network failure.
- WebSocket disconnection.
- Concurrent membership changes.
- Failed group update.
- Failed member addition or removal.

Display user-friendly messages without exposing stack traces or sensitive backend details.

Follow existing error-handling conventions.

## 12. Loading and Empty States

Provide appropriate loading and empty states.

Examples:

- Loading group information.
- Loading members.
- Adding member.
- Saving group name.
- Removing member.
- Leaving group.
- No members available to add.
- Unable to load group information.

Disable relevant actions while requests are in progress.

Prevent duplicate form submissions.

## 13. Performance

Avoid unnecessary requests and rendering.

Requirements:
- Reuse existing conversation and group data when possible.
- Avoid repeatedly fetching the same member list without a reason.
- Avoid N+1 queries if the existing backend can return the required information efficiently.
- Avoid recreating WebSocket subscriptions unnecessarily.
- Use stable React keys based on backend IDs.
- Avoid introducing a new global state-management library.

Do not add unnecessary dependencies.

## 14. Security

Verify:
- JWT authentication remains unchanged.
- Group authorization is enforced by the backend.
- Frontend hiding of buttons is not treated as authorization.
- Removed members lose access to protected group resources.
- Unauthorized users cannot subscribe to or continue receiving protected group events.
- No sensitive information is exposed through error messages or logs.

Add regression tests for authorization failures.

## 15. Backend Tests

Add or update tests using the existing backend test conventions.

Cover:
- Owner can rename a group.
- Non-owner cannot rename a group.
- Owner can add eligible friends.
- Non-owner cannot add members.
- Duplicate membership is prevented.
- Maximum group size is enforced.
- Unauthorized member removal is rejected.
- Removed members cannot access protected group resources.
- Departed members cannot send new group messages.
- Concurrent membership changes preserve data integrity.
- Existing Direct Chat authorization still works.

Test WebSocket authorization and membership-change behavior where supported by the existing test infrastructure.

## 16. Web Tests

Add or update tests following the existing Web testing conventions.

Cover:
- Group information renders.
- Owner-only actions display correctly.
- Rename validation works.
- Successful rename updates the group header and conversation list.
- Add-member selection excludes existing members.
- Successful addition refreshes member information.
- Remove-member confirmation and results.
- Leave-group behavior.
- Realtime group updates do not create duplicate UI entries.
- Unauthorized or failed operations display appropriate errors.
- Direct Chat and existing Messages layout remain functional.

Do not introduce a completely new testing framework.

## 17. Manual Verification

Use at least three test accounts:

- A: Group owner.
- B: Group member.
- C: Eligible friend who is not yet a member.

Verify:

1. A renames the group.
2. B sees the updated group name.
3. A adds C.
4. Group members see the updated member list.
5. A removes B, if supported by the product rules.
6. B loses access to protected group resources after removal.
7. C can read and send group messages after joining.
8. An unrelated non-member cannot access the group.
9. A regular member can leave the group where permitted.
10. Direct Chat still works.
11. Switching conversations does not create duplicate WebSocket subscriptions or messages.
12. Reconnecting updates the UI correctly.

Record which scenarios were actually tested. Do not claim manual verification for scenarios that were not executed.

## 18. Regression and Validation

Run the existing validation commands for the affected projects.

### Backend
- Run the Maven Wrapper test suite.
- Run any relevant integration tests.
- Verify Flyway migrations if changes are needed.

### Web
- Run the existing tests.
- Run TypeScript type checking if available.
- Run lint if available.
- Run the production build.

Typical commands may include:

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

Inspect the actual scripts in `package.json` and use only commands supported by the project.

Do not run Mobile builds or Mobile tests as part of this prompt.

Fix errors introduced by the implementation.

## 19. Regression Checklist

Verify the following existing Web features:
- Login and registration.
- Protected routes and logout.
- Home.
- User search.
- Nearby users.
- Friends and friend requests.
- Direct Chat.
- Group Chat.
- Messages split layout.
- WebSocket messaging.
- Notifications and unread count.
- Profile and settings.

Keep existing Mobile code untouched except for unavoidable shared backend/API compatibility concerns.

## 20. Scope Protection

Do not implement:
- Mobile UI or Mobile-specific features.
- Ownership transfer.
- Public groups.
- Invitation links.
- Group discovery.
- Media or file uploads.
- Voice/video calls.
- Message reactions.
- Typing indicators.
- Read receipts.
- Message editing or deletion.
- Location sharing.
- Background location.
- A new authentication system.
- A new WebSocket architecture.
- An unnecessary state-management framework.
- A full redesign of the Web application.

Focus only on:

Backend:
- Group metadata and membership operations.
- Authorization and data integrity.
- Realtime synchronization.
- Tests and API documentation.

Web:
- Group information.
- Rename group.
- Add/remove members.
- Leave group.
- Realtime UI synchronization.
- Loading, error, and empty states.

## 21. Final Report

Report:
1. Backend files and modules changed.
2. Web files and components changed.
3. New or updated endpoints and DTOs.
4. Group permissions implemented.
5. Database migrations or constraints added.
6. Realtime event changes.
7. Tests added and results.
8. Backend test results.
9. Web test, typecheck, lint, and build results.
10. Manual scenarios actually verified.
11. Known limitations.
12. Confirmation that Mobile UI and Mobile-specific features were not changed.

At the end, output exactly one of:

`PROMPT_028 COMPLETE`

or

`PROMPT_028 NOT COMPLETE`

Only report COMPLETE when the required acceptance criteria have passed. Clearly identify any unimplemented or unverified requirements.

---

## 22. Bổ sung sau triển khai (ghi chú để đọc lại)

Bốn chức năng được yêu cầu thêm sau khi hoàn thành các mục trên. Tất cả đã triển khai; Maven 73/73, Vitest 81/81, `npm run build` đạt.

1. **Dialog xác nhận nhóm:** xóa thành viên và rời nhóm dùng dialog tự dựng (`role="dialog"`, có mô tả hậu quả, trạng thái "Working…"), không còn `window.confirm`. File: `GroupInfoPanel.tsx`.
2. **Nearby nhắn tin không cần kết bạn (giới hạn 5 tin):**
   - API mới `POST /api/v1/chats/contextual` (`userId`, `radiusMeters`). Backend tự kiểm tra: đang trong bán kính theo vị trí đã lưu, hoặc chung một nhóm. Client không thể tự cấp quyền.
   - Cuộc trò chuyện vẫn có `type = DIRECT` (giữ tương thích Mobile), khóa `LIMITED:<min>:<max>`, cột mới `conversations.contextual_limited` (migration `V11__add_nearby_limited_conversations.sql`).
   - Tổng 5 tin của cả hai người, tính chung cho REST và STOMP; khóa hàng conversation khi gửi. `ConversationDetailResponse.limitedMessagesRemaining` trả số tin còn lại; Web hiển thị và khóa ô nhập khi hết.
   - Nếu hai người sau đó kết bạn, `openDirectConversation` dùng lại cuộc trò chuyện cũ và gỡ giới hạn. `listConversations` chỉ giữ một dòng mỗi người (xử lý dữ liệu trùng cũ).
3. **Menu ba chấm trong Group Info:** mỗi thành viên (trừ chính mình) có dropdown: Add friend / Friends, Message, và Remove from group (chỉ owner). Message dùng `openDirectConversation` nếu đã là bạn, ngược lại `openContextualConversation`.
4. **Presence Online/Offline:** header Direct Chat hiển thị trạng thái người kia thay vì "Live" của kết nối cục bộ.
   - `GET /api/v1/chats/{conversationId}/presence` (chỉ thành viên); STOMP `/topic/presence/{userId}` (chỉ người chung conversation DIRECT).
   - `WebSocketSessionRegistry` đếm session theo user, phát `UserPresenceResponse(userId, online)` khi session đầu tiên kết nối / cuối cùng ngắt. Web tải lại snapshot khi reconnect. Nhóm vẫn hiện trạng thái kết nối.

Tài liệu hợp đồng: `docs/technical/realtime.md`, `docs/technical/security.md`.

### Lưu ý khi đọc lại
- Migration V11 từng đổi tên cột (`nearby_limited` → `contextual_limited`). Nếu DB cũ đã chạy bản đầu, cần `flyway repair` / kiểm tra cột.
- Chưa chạy migration trên PostgreSQL ngoài môi trường dev của người dùng; test tự động dùng H2.
- Đã từng gặp lỗi 500 một lần trên server đang chạy mà không tái hiện lại được; nếu xuất hiện lại cần stack trace từ console server.
- Các tài khoản thử `zzprobe_*` còn trong DB dev (không có API xóa).
- Chưa thực hiện kiểm thử thủ công ba tài khoản theo mục 17 trên trình duyệt.

### Bổ sung lần 2: layout giật + xóa group
- **Nguyên nhân giật:** `useNavigate()` đổi identity mỗi lần đổi route, mà `load()` của `MessagesPage` phụ thuộc vào nó → mỗi lần click hội thoại là hiện spinner "Loading conversations…" và tải lại toàn bộ (conversations, friends, N lần `getGroup`), đồng thời đăng ký lại subscription group-events. Đã giữ `navigate` trong ref, `load` chỉ phụ thuộc `token`; mở chat từ friend cập nhật danh sách cục bộ, không gọi lại API. Thêm `titleHint` để header không nháy tên, `scrollbar-gutter: stable`, và `min-width` cho nhãn presence.
- **Group không thành viên:** `listConversations` trước đây bỏ qua group chỉ có owner (nên "biến mất"); nay vẫn hiển thị. Thêm `DELETE /api/v1/groups/{groupId}` (chỉ owner) xóa tin nhắn, thành viên và group, phát `GROUP_DELETED` tới từng thành viên (`GroupManagementEvent.member` = người nhận). Web: nút "Delete group" có dialog xác nhận cho owner; form tạo group yêu cầu chọn ít nhất 1 bạn (backend vẫn cho tạo group chỉ có owner để tương thích Mobile).
