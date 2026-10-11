# PROMPT_035 — GeoChat Secure Image Sharing & Attachment Preview

## 1. Project Context

GeoChat is a location-based social messaging application.

Technology stack:
- Backend: Java 21, Spring Boot 4.1.0, Maven Wrapper.
- Database: PostgreSQL/PostGIS, Flyway.
- Security: JWT.
- Realtime: WebSocket/STOMP.
- Web: React, TypeScript, Vite.
- Architecture: Modular monolith.
- Mobile: Existing codebase, currently on hold.

Previous milestones:
- PROMPT_028: Group Management and Conversation Synchronization.
- PROMPT_029: Web Messaging UX Enhancements.
- PROMPT_030: Unread Messages and Read State.
- PROMPT_031: Web UI/UX Polish.
- PROMPT_032: Theme, Micro-interactions and UX Quality.
- PROMPT_033: Typing Indicator and Online Presence.
- PROMPT_034: Message Reply, Emoji Reactions and Message Actions.

PROMPT_034 was proposed in the preceding milestone. Inspect the repository to verify its actual completion and current implementation before proceeding.

Primary goal:
Implement secure image sharing for DIRECT and GROUP conversations, with a polished Web user experience and minimal, maintainable Backend extensions.

Do not implement general file sharing, video, audio, voice messages, or cloud storage in this milestone.

---

# PART A — DEVELOPMENT RULES

## 2. Web-first Development

Prioritize:
- Image selection.
- Attachment preview.
- Upload feedback.
- Image messages.
- Image viewer.
- Responsive behavior.
- Accessibility.
- Error handling.
- Existing chat integration.

## 3. Backend Scope

Implement only the functionality required for secure image sharing.

Reuse:
- JWT authentication.
- Existing chat authorization.
- Message persistence.
- WebSocket message delivery.
- Existing message DTO conventions.
- Flyway migrations.

Do not redesign the chat architecture.

## 4. Mobile — Strictly Excluded

- Do not modify Mobile source code.
- Do not implement Mobile UI.
- Do not implement Mobile image sharing.
- Do not run Mobile build.
- Do not run Mobile typecheck.
- Do not run Mobile tests.

Read Mobile source only when needed to assess API compatibility.

Preserve existing Mobile-facing API contracts whenever reasonable.

## 5. Architecture Rules

- Preserve existing REST endpoints.
- Preserve existing message IDs.
- Preserve existing message ordering.
- Preserve existing message pagination.
- Preserve existing unread/read-cursor behavior.
- Preserve Reply and Reactions if implemented.
- Preserve typing and presence.
- Avoid unnecessary dependencies.
- Avoid large refactoring.
- Do not store image binary data in PostgreSQL.
- Do not send image binary data through WebSocket.

---

# PART B — REPOSITORY AUDIT

## 6. Inspect Before Coding

Inspect the actual repository.

Backend:
1. Message entity.
2. Message DTOs.
3. ChatController.
4. ChatService.
5. ChatWebSocketController.
6. Conversation authorization.
7. Existing Flyway migrations.
8. Group deletion logic.
9. Existing upload/storage utilities, if any.
10. Existing application configuration.
11. Existing exception handling.
12. Existing security configuration.

Web:
1. ChatPanel.
2. Message composer.
3. Message rendering.
4. Message sending state.
5. WebSocket subscriptions.
6. Message presentation utilities.
7. Existing attachment components, if any.
8. Existing theme tokens.
9. Existing dialogs.
10. Existing Web tests.

Also inspect the actual PROMPT_034 implementation if present.

Before coding, report:
- Current message model.
- Existing attachment support, if any.
- Current storage configuration.
- Proposed database changes.
- Proposed API endpoints.
- Authorization strategy.
- File cleanup strategy.
- Expected modified files.

Do not assume that image support is absent without checking.

---

# PART C — IMAGE SHARING DESIGN

## 7. Feature Scope

Implement:

1. Select image from local device.
2. Preview selected image.
3. Remove selected image before sending.
4. Upload image securely.
5. Send image as a chat message.
6. Display image inside the conversation.
7. Open image in a larger viewer.
8. Handle upload failures.
9. Support DIRECT and GROUP conversations.
10. Synchronize image messages through existing realtime messaging.

Initial limitations:
- Images only.
- Maximum 5 MB per image.
- Maximum one image per message.
- Supported formats: JPEG, PNG, WebP.
- Optional text caption if compatible with existing message architecture.

Do not implement GIF animation support, video, PDF, ZIP, or arbitrary attachments.

Keep the design extensible for future attachment types.

## 8. Storage Strategy

Use local filesystem storage for the initial implementation.

Introduce a small storage abstraction only if needed.

Suggested responsibilities:
- Store image.
- Read image.
- Delete image.
- Resolve storage metadata.

Do not introduce S3 or MinIO yet.

Storage requirements:
- Configurable root directory.
- Files stored outside source code.
- Files excluded from Git.
- Generated internal filenames.
- No user-controlled filesystem paths.
- No path traversal.
- No public static directory exposing private files.

Do not rely on the original filename as the storage path.

## 9. Storage Configuration

Use environment-based configuration.

Suggested configuration:

geochat.upload.storage-path
geochat.upload.max-image-size
geochat.upload.allowed-types

Follow existing application.yml conventions.

Provide safe local-development defaults where appropriate.

Do not commit sensitive credentials.

Document the storage path for local development and Docker.

Do not modify Docker infrastructure unnecessarily.

## 10. Database Design

Inspect the existing Message schema before choosing the implementation.

Recommended approach:
- Keep the existing Message entity as the central chat record.
- Add attachment metadata in a separate table.
- Link attachments to persisted messages.

Suggested attachment metadata:
- id
- message_id
- storage_key
- original_filename
- content_type
- size_bytes
- width
- height
- created_at

Optional metadata:
- uploader_id

Use existing naming conventions.

Do not store raw image binary in the database.

Preserve text-only messages.

Do not require existing messages to have attachments.

## 11. Flyway Migration

Create a new Flyway migration.

Requirements:
- Do not edit applied migrations.
- Preserve existing message data.
- Add appropriate foreign keys.
- Add indexes where useful.
- Define cleanup behavior.
- Support existing group hard deletion.
- Avoid orphaned attachment metadata.

If the existing message model requires a content-type indicator, introduce it carefully and preserve old clients.

Do not add unnecessary generic attachment abstractions.

---

# PART D — SECURE UPLOAD

## 12. Upload API

Implement an authenticated upload endpoint following existing REST conventions.

Suggested workflow:

1. Client selects an image.
2. Client uploads the image.
3. Backend validates and stores it.
4. Backend returns an opaque temporary upload identifier.
5. Client sends a chat message referencing that identifier.
6. Backend verifies ownership and binds the uploaded image to the message.

This is a proposed workflow.

If the repository already has a safer or simpler attachment pattern, reuse it.

Important:
An uploaded image must not automatically become visible to arbitrary users.

## 13. Upload Validation

Validate:
- File exists.
- File is not empty.
- File size is within limit.
- Declared MIME type is allowed.
- Actual file content matches an allowed image format.
- Image can be decoded successfully.
- Image dimensions are reasonable.
- File is not a malformed or unsupported image.

Do not trust:
- Filename extension alone.
- Client-provided MIME type alone.
- Client-provided dimensions.
- Client-provided storage path.

Reject unsupported files with clear errors.

Do not expose internal filesystem paths.

## 14. Secure Image Processing

Prefer server-generated filenames.

Ensure:
- No executable uploads.
- No SVG uploads.
- No HTML uploads.
- No arbitrary filesystem access.
- No path traversal.
- No direct access to the storage root.
- No public access through static file mappings.

Use safe image decoding.

If re-encoding is practical with existing libraries, consider normalizing uploaded images to reduce metadata and malformed-file risks.

Avoid adding a heavy image-processing framework solely for this milestone.

Document any metadata or image-processing limitations.

## 15. Temporary Upload Lifecycle

If using a two-step upload workflow:

- Associate temporary uploads with the authenticated uploader.
- Enforce a short expiration period.
- Prevent another user from claiming an upload.
- Prevent the same upload from being attached to multiple unrelated messages.
- Reject expired uploads.
- Clean up abandoned uploads.
- Handle failed message creation.
- Avoid deleting a file that has already been attached successfully.

Use a simple cleanup strategy compatible with the current single-instance development environment.

Do not introduce a distributed job system.

## 16. Image Access Authorization

Images in private conversations must remain private.

Implement an authenticated image retrieval endpoint.

Requirements:
- Validate JWT.
- Validate access to the associated conversation.
- Validate access according to current conversation membership rules.
- Do not expose filesystem paths.
- Do not provide permanent public URLs.
- Return the correct image content type.
- Avoid leaking images to unauthorized users.

For temporary uploads, only the uploader should be able to preview the uploaded file.

For attached images, apply existing conversation authorization rules.

Do not use publicly accessible /uploads/** mappings for private chat images.

## 17. Group Membership and Deletion

Handle:
- Removed group members.
- Users leaving groups.
- Deleted groups.
- Group owner deletion.

Requirements:
- Unauthorized former members cannot retrieve private group images.
- Deleted group images cannot remain accessible.
- Attachment metadata is deleted correctly.
- Physical files are cleaned up safely.
- Files are not deleted before required database operations succeed.

Design file cleanup to tolerate partial failures.

Do not introduce a large background processing system.

---

# PART E — MESSAGE INTEGRATION

## 18. Image Message Model

Integrate attachments into existing persisted chat messages.

Requirements:
- Preserve messageId.
- Preserve conversationId.
- Preserve senderId.
- Preserve createdAt.
- Preserve ordering.
- Preserve pagination.
- Preserve unread behavior.
- Preserve WebSocket delivery.

Support:
- Text-only message.
- Image-only message.
- Image with optional caption, if compatible.

Do not use a separate parallel chat timeline for image messages.

## 19. REST Message Contract

Extend the existing message send workflow carefully.

Possible new optional fields:
- attachmentId
- attachment metadata

Preserve existing text-only requests.

If the current request requires nonblank content, update validation carefully so that:
- Text-only messages remain valid.
- Image-only messages are valid.
- Completely empty messages remain invalid.

Inspect Mobile JSON parsing before adding optional fields to shared DTOs.

Do not silently break strict decoders.

## 20. Image Message Response

Return safe attachment metadata.

Suggested fields:
- attachmentId
- contentType
- width
- height
- sizeBytes

Do not expose:
- Absolute storage path.
- Internal storage key.
- Server filesystem details.

Avoid embedding binary data or base64 images in JSON.

Ensure image metadata is available for both:
- REST message history.
- Realtime message events.

Avoid N+1 queries when loading paginated messages.

## 21. WebSocket Integration

Preserve:

/topic/chat/{conversationId}

Continue broadcasting persisted message events using the existing message delivery mechanism.

Image messages should:
- Receive stable message IDs.
- Appear in the correct order.
- Be deduplicated by messageId.
- Survive page refresh.
- Be available through REST history.
- Update conversation previews appropriately.

Do not send raw binary through STOMP.

Do not introduce a second message stream for attachments.

---

# PART F — WEB ATTACHMENT UX

## 22. Image Selection

Add an attachment action to the existing message composer.

Use:
- An accessible attachment button.
- Native file selection.

Accept:
- image/jpeg
- image/png
- image/webp

Requirements:
- One image per message.
- Clear unsupported-file feedback.
- Clear oversized-file feedback.
- No accidental send.
- Preserve existing text draft.
- Preserve Enter/Shift+Enter behavior.
- Preserve Vietnamese IME behavior.

Do not redesign the composer unnecessarily.

## 23. Attachment Preview

After selecting an image:

- Show a thumbnail preview.
- Show filename or useful metadata.
- Allow removing the image.
- Preserve the existing text draft.
- Clearly indicate that the image has not yet been sent.

Use an object URL or an existing safe preview mechanism.

Clean up object URLs to avoid memory leaks.

Do not upload automatically unless the chosen UX clearly requires it.

## 24. Upload Progress

Provide useful feedback during upload.

States:
- Selected.
- Uploading.
- Sending.
- Sent.
- Failed.

Requirements:
- Avoid duplicate submissions.
- Prevent accidental repeated uploads.
- Provide retry or recovery behavior.
- Keep the UI responsive.
- Preserve draft/selection on recoverable failures.

Use actual progress only if the existing HTTP client supports it.

Do not simulate inaccurate percentage progress.

If precise progress is unavailable, use an indeterminate loading indicator.

## 25. Image Message Rendering

Render images inside existing message bubbles.

Requirements:
- Responsive thumbnail.
- Preserve aspect ratio.
- Reasonable maximum width.
- No horizontal overflow.
- Avoid layout shifts.
- Support Light/Dark themes.
- Display caption if present.
- Show loading placeholder.
- Show graceful error state for unavailable images.

Use image dimensions when available to reserve space.

Do not let large images dominate the chat layout.

## 26. Authenticated Image Loading

Because images are private and protected by JWT, do not assume a normal public image URL will work.

Use the existing authentication approach to retrieve image bytes securely.

Requirements:
- Do not put JWT tokens in query parameters.
- Do not expose tokens in image URLs.
- Avoid logging tokens.
- Avoid leaking authenticated image data.
- Revoke object URLs when no longer needed.
- Avoid redundant downloads where practical.

Choose a simple, maintainable implementation.

Do not introduce a complex caching layer prematurely.

## 27. Image Viewer

Allow clicking an image to open a larger viewer.

Requirements:
- Modal or lightbox.
- Larger image display.
- Close button.
- Escape to close.
- Click outside to close when appropriate.
- Keyboard accessibility.
- Focus management.
- Focus restoration.
- Responsive sizing.
- Light/Dark theme compatibility.

Do not implement image editing.

Do not implement galleries or albums yet.

## 28. Conversation Switching

When switching conversations:
- Preserve existing text draft behavior.
- Avoid accidentally attaching an image to another conversation.
- Cancel or isolate pending upload state appropriately.
- Clean up temporary browser resources.
- Avoid stale callbacks affecting the new conversation.
- Avoid duplicate messages.
- Avoid unnecessary conversation reloads.

Use the existing conversation-state architecture.

Do not introduce global loading flicker.

## 29. Conversation Previews

Update conversation previews for image messages.

Examples:
- "📷 Photo"
- "📷 Photo: caption..."

Follow existing localization conventions.

Requirements:
- Correct latest-message ordering.
- Correct unread indicators.
- Correct conversation sorting.
- No broken previews when attachments are unavailable.

Do not introduce new API requests for each conversation preview.

---

# PART G — SECURITY & PERFORMANCE

## 30. Security Requirements

Enforce:
- Authentication for uploads.
- Authentication for image retrieval.
- Conversation authorization.
- File type validation.
- File size validation.
- Safe storage paths.
- No public private-image URLs.
- No arbitrary file reads.
- No storage key exposure.
- No unauthorized attachment reuse.

Avoid revealing whether a private image exists to unauthorized users.

## 31. Resource Limits

Set reasonable limits:
- Maximum image size: 5 MB.
- One image per message.
- Supported formats: JPEG, PNG, WebP.

Also enforce limits on:
- Image dimensions.
- Decode resource usage.
- Multipart request size.
- Temporary upload lifetime.

Do not rely only on frontend validation.

## 32. Performance

Avoid:
- Base64 image storage in message JSON.
- Image binary through WebSocket.
- N+1 attachment metadata queries.
- Repeated image downloads.
- Unnecessary full-history reload.
- Blocking UI during upload.
- Layout shifts from image loading.
- Excessive React rerenders.

Prefer lazy loading for historical images where appropriate.

Do not introduce a CDN or external image service.

---

# PART H — TESTING

## 33. Backend Tests

Test:
1. Valid JPEG upload.
2. Valid PNG upload.
3. Valid WebP upload.
4. Empty file rejection.
5. Oversized file rejection.
6. Unsupported MIME type.
7. Spoofed extension.
8. Invalid image bytes.
9. Unauthorized upload.
10. Unauthorized image retrieval.
11. Cross-user temporary upload reuse.
12. Expired temporary upload.
13. Text-only message regression.
14. Image-only message.
15. Image with caption.
16. Attachment metadata persistence.
17. Message history with images.
18. WebSocket image message payload.
19. Group member access.
20. Removed member access denial.
21. Group deletion cleanup.
22. Temporary upload cleanup.
23. Duplicate submission behavior.
24. Path traversal protection.

Use existing Backend testing conventions.

## 34. Web Tests

Test:
1. Open image picker.
2. Select valid image.
3. Reject unsupported file.
4. Reject oversized file.
5. Preview image.
6. Remove selected image.
7. Upload loading state.
8. Upload failure.
9. Retry behavior.
10. Image-only message.
11. Image with caption.
12. Image bubble rendering.
13. Image viewer.
14. Escape closes viewer.
15. Conversation switching.
16. Existing text draft preservation.
17. Light/Dark theme.
18. Responsive layout.
19. Unread behavior.
20. Message deduplication.
21. Object URL cleanup.

Use existing Web testing tools.

## 35. Manual Verification

Use at least two accounts.

Scenario A — DIRECT:
- A selects an image.
- A previews the image.
- A sends it.
- B receives it in realtime.
- B opens the image viewer.

Scenario B — GROUP:
- A sends an image to a group.
- Other members receive it.
- A removed member cannot retrieve the image.

Scenario C — Invalid File:
- Select an unsupported file.
- Verify clear error feedback.
- Confirm no invalid message is created.

Scenario D — Network Failure:
- Start upload.
- Simulate failure.
- Verify safe recovery.
- Verify no duplicate message.

Scenario E — Refresh:
- Send an image.
- Refresh the page.
- Verify the image remains visible in history.

Scenario F — Responsive:
- Check 375px.
- Check 768px.
- Check 1440px.
- Verify composer, preview, bubble and viewer.

## 36. Regression Checklist

Verify:
- Authentication.
- Logout.
- DIRECT text chat.
- GROUP text chat.
- Group management.
- Group deletion.
- Message ordering.
- Message pagination.
- Smart scrolling.
- Unread counts.
- Mark-as-read.
- Typing Indicator.
- Online Presence.
- Reply.
- Emoji Reactions.
- Message Actions.
- Conversation search.
- Conversation sorting.
- Notifications.
- Theme switching.
- Responsive layout.

Do not run Mobile tests.

## 37. Validation Commands

Inspect repository scripts.

Run:
- Web production build.
- Existing Web tests.
- Web typecheck/lint if available.
- Relevant Backend tests via Maven Wrapper.

If Docker is used for local PostgreSQL, document required setup commands.

Do not rebuild unrelated infrastructure unnecessarily.

Report actual test results.

---

# PART I — IMPLEMENTATION PHASES

## 38. Phase 1 — Architecture and Storage

- Audit current implementation.
- Confirm compatibility.
- Design attachment schema.
- Create Flyway migration.
- Implement local storage configuration.
- Implement storage service.
- Add storage tests.

## 39. Phase 2 — Secure Upload

- Implement authenticated upload.
- Implement validation.
- Implement temporary upload lifecycle.
- Implement secure image retrieval.
- Add authorization tests.

## 40. Phase 3 — Message Integration

- Extend message persistence.
- Extend message DTOs compatibly.
- Integrate attachments with message sending.
- Integrate REST history.
- Integrate WebSocket events.
- Handle group deletion.
- Add tests.

## 41. Phase 4 — Web UI

- Add attachment button.
- Add image selection.
- Add preview.
- Add upload feedback.
- Render image bubbles.
- Add image viewer.
- Update conversation previews.
- Add Web tests.

## 42. Phase 5 — Security and Regression

- Verify access control.
- Verify cleanup.
- Verify invalid file handling.
- Verify DIRECT/GROUP behavior.
- Verify existing Reply/Reactions.
- Run Web and Backend checks.
- Document remaining limitations.

Complete each phase before moving to the next.

---

# PART J — ACCEPTANCE CRITERIA

## 43. Completion Checklist

PROMPT_035 is complete when:

- [ ] DIRECT image sharing works.
- [ ] GROUP image sharing works.
- [ ] Only JPEG, PNG and WebP are accepted.
- [ ] 5 MB limit is enforced.
- [ ] Image preview works before sending.
- [ ] Image can be removed before sending.
- [ ] Upload feedback is clear.
- [ ] Image-only messages work.
- [ ] Image captions work if supported.
- [ ] Image messages persist.
- [ ] Image messages arrive through existing realtime messaging.
- [ ] Images remain visible after refresh.
- [ ] Image viewer works.
- [ ] Unauthorized users cannot retrieve private images.
- [ ] Removed group members cannot retrieve group images.
- [ ] Temporary uploads expire and are cleaned up.
- [ ] Group deletion cleans up attachment metadata and files.
- [ ] No duplicate messages.
- [ ] No unnecessary layout shifts.
- [ ] Text messaging remains operational.
- [ ] Reply/Reactions remain operational if implemented.
- [ ] Unread/read state remains correct.
- [ ] Web build passes.
- [ ] Relevant Backend tests pass.
- [ ] Mobile source remains unchanged.

## 44. Final Report

Provide a Vietnamese report containing:

1. Initial architecture audit.
2. Storage strategy.
3. Database migrations.
4. Backend upload APIs.
5. Image retrieval authorization.
6. Message integration.
7. Web UI changes.
8. Files modified.
9. Security validation.
10. Cleanup strategy.
11. Backend test results.
12. Web build/test results.
13. Manual verification actually performed.
14. Regression results.
15. Mobile compatibility assessment.
16. Known limitations.
17. Suggested scope for PROMPT_036.

Clearly distinguish:
- Implemented and tested.
- Implemented but not manually verified.
- Not implemented.

End with exactly one of:

PROMPT_035 COMPLETE

or

PROMPT_035 NOT COMPLETE

Only report COMPLETE when all required acceptance criteria have passed.