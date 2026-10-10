# PROMPT_031 — GeoChat Web UI/UX Polish & Responsive Improvements

## 1. Project Context

GeoChat is a location-based social messaging application.

Technology stack:
- Backend: Java 21, Spring Boot 4.1.0, Maven.
- Database: PostgreSQL/PostGIS, Flyway.
- Web: React, TypeScript, Vite.
- Realtime: WebSocket/STOMP.
- Mobile: Existing codebase, currently on hold.

Completed milestones:
- PROMPT_027: Web Group Chat and Messages Layout.
- PROMPT_028: Group Management and Conversation Synchronization.
- PROMPT_029: Web Messaging UX Enhancements.
- PROMPT_030: Unread Messages and Read State.

PROMPT_030 is confirmed complete.

The application already supports messaging, conversation search, sorting, unread counts, realtime updates, and responsive chat layouts.

This prompt focuses on improving the visual quality, consistency, responsiveness, and usability of the existing Web application.

Do not duplicate previously completed features.

## 2. Development Rules

### Web — Primary Focus
Prioritize UI/UX, responsive design, accessibility, and interaction quality.

### Backend — Avoid Changes
Do not modify Backend unless a critical issue prevents the required Web improvements.

### Mobile — Strictly Excluded
- Do not modify Mobile code.
- Do not implement Mobile UI or features.
- Do not run Mobile build, typecheck, or tests.
- Preserve existing API compatibility.

### Architecture
- Preserve existing routes.
- Preserve existing REST APIs.
- Preserve WebSocket behavior.
- Avoid unnecessary dependencies.
- Do not rewrite working business logic.

## 3. Inspect Before Coding

Inspect the actual Web application before making changes.

Review:
1. Main application layout and navigation.
2. MessagesPage.
3. Conversation sidebar.
4. Chat header.
5. Message bubbles.
6. Message composer.
7. Unread badges and filters.
8. Friends page.
9. Nearby page.
10. Notifications.
11. Profile and Settings.
12. Existing CSS, theme variables, and shared components.
13. Responsive breakpoints.
14. Existing accessibility patterns.

Identify:
- Inconsistent spacing.
- Inconsistent typography.
- Unclear navigation.
- Layout overflow.
- Poor mobile-browser usability.
- Missing interaction feedback.
- Inconsistent buttons and inputs.
- Unnecessary visual clutter.

Before coding, briefly summarize the UI/UX problems found and propose a focused implementation plan.

Do not invent problems that are not present.

## 4. Design Direction

Target a clean, modern social messaging experience.

Design principles:
- Minimal and readable.
- Consistent spacing.
- Clear visual hierarchy.
- Subtle borders and shadows.
- Rounded components.
- Accessible color contrast.
- Predictable navigation.
- Responsive across desktop, tablet, and mobile browsers.

Take inspiration from modern messaging applications, but do not directly copy another application's branding.

Preserve GeoChat's existing identity where reasonable.

Avoid excessive gradients, animations, and decorative elements.

## 5. Design Tokens

Review existing theme variables first.

If necessary, consolidate reusable design tokens for:

- Primary color.
- Background colors.
- Surface colors.
- Text colors.
- Muted text.
- Border colors.
- Hover states.
- Active states.
- Error/success states.
- Border radius.
- Spacing.
- Typography.
- Shadows.

Prefer CSS variables and existing styling conventions.

Do not introduce Tailwind, Material UI, or another design framework solely for this prompt.

Avoid rewriting the entire stylesheet.

## 6. Application Layout & Navigation

Improve the overall Web application shell.

Requirements:
- Consistent page widths and padding.
- Clear active navigation state.
- Predictable sidebar behavior.
- Stable headers.
- Appropriate content hierarchy.
- No unwanted horizontal scrolling.
- No unnecessary layout shifts.

Desktop:
- Navigation should remain easy to discover.
- Main content should use available space efficiently.

Tablet:
- Adapt spacing and navigation appropriately.

Mobile browser:
- Ensure primary navigation is accessible.
- Avoid overlapping content.
- Avoid oversized fixed-width elements.
- Preserve usable touch targets.

Do not change route paths unnecessarily.

## 7. Messages Page UI Polish

Improve the existing Messages interface.

### Conversation Sidebar

- Improve alignment of avatars, names, previews, timestamps, and unread badges.
- Clearly distinguish selected conversations.
- Clearly distinguish unread conversations.
- Add subtle hover and focus states.
- Preserve search and All/Unread filters.
- Handle long names gracefully.
- Preserve conversation sorting.
- Preserve owner-only group visibility.

Do not trigger additional API requests for visual changes.

### Chat Header

- Improve spacing and alignment.
- Keep conversation title readable.
- Display available conversation metadata consistently.
- Preserve existing group information actions.
- Avoid title flicker during navigation.

### Message Bubbles

- Improve visual distinction between outgoing and incoming messages.
- Keep bubble widths comfortable.
- Support multiline messages.
- Handle long URLs and unbroken text.
- Use consistent timestamps.
- Preserve group sender identification.
- Avoid excessive vertical spacing.

### Message Composer

- Improve input styling.
- Keep Send action easy to identify.
- Provide clear focus and disabled states.
- Preserve Enter/Shift+Enter behavior.
- Preserve Vietnamese IME behavior.
- Preserve sending and failure states.
- Preserve unsent drafts according to existing behavior.

Do not change message-send semantics.

## 8. Responsive Messages Experience

Preserve the working responsive behavior from PROMPT_029.

At narrow viewport widths:
- Conversation list remains usable.
- Opening a chat shows the conversation clearly.
- Back navigation remains obvious.
- Composer remains accessible.
- Virtual keyboard does not unnecessarily obscure the input.
- No horizontal overflow.
- Unread badges remain visible.

Preserve smart scrolling and scroll position behavior.

Do not introduce a new mobile-specific application architecture.

## 9. Friends Page Polish

Review the existing Friends UI.

Improve only where needed:
- Friend list readability.
- Search input styling.
- Friend request presentation.
- Accept/reject action clarity.
- Empty states.
- Loading states.
- Responsive layout.

Preserve existing friendship logic.

Do not implement new friend features.

## 10. Nearby Page Polish

Review the existing Nearby UI.

Improve:
- Page structure.
- Search/filter control alignment, if present.
- Location permission explanations.
- Loading and empty states.
- Error messages.
- Responsive presentation.

If a map already exists, improve its surrounding UI without replacing the map library.

Do not add new location tracking features.

Do not request additional location permissions unnecessarily.

## 11. Notifications UI Polish

Review existing notifications.

Improve:
- Notification item readability.
- Unread visual distinction.
- Timestamp presentation.
- Empty state.
- Loading state.
- Responsive behavior.

Preserve existing notification logic and APIs.

Do not introduce browser push notifications.

## 12. Profile & Settings Polish

Improve existing profile and settings screens.

Focus on:
- Clear section grouping.
- Consistent form controls.
- Readable labels.
- Save/cancel action clarity.
- Validation feedback.
- Responsive spacing.

Do not introduce new account settings or security features.

## 13. Shared UI Components

Reuse existing components where possible.

If repeated patterns are found, consider small reusable components such as:

- EmptyState.
- LoadingState.
- ErrorState.
- Avatar.
- StatusBadge.
- SectionHeader.

Only extract components when it reduces duplication and improves maintainability.

Do not create an unnecessarily large component library.

## 14. Interaction Feedback

Ensure interactive elements have appropriate:

- Hover states.
- Focus-visible states.
- Active states.
- Disabled states.
- Loading feedback.
- Error feedback.
- Success feedback where appropriate.

Avoid intrusive notifications for routine actions.

Use existing toast and modal patterns.

Do not add a new notification library.

## 15. Accessibility

Improve accessibility without large architectural changes.

Requirements:
- Semantic buttons and inputs.
- Appropriate accessible labels.
- Keyboard-operable navigation.
- Visible keyboard focus.
- Accessible form error messages.
- Sufficient text contrast.
- Touch-friendly controls.
- Respect reduced-motion preferences.

Do not rely on color alone to communicate important state.

## 16. Performance & Stability

Preserve all performance improvements from PROMPT_028 through PROMPT_030.

Critical requirements:
- No full conversation-list reload when switching chats.
- No unnecessary WebSocket resubscriptions.
- No duplicate message rendering.
- No unnecessary global loading spinner.
- No conversation header flicker.
- No unread count regression.
- No accidental mark-read behavior.
- No scroll position regression.

Avoid adding expensive animations or unnecessary React effects.

Prefer CSS-based transitions for simple visual feedback.

## 17. Testing

Run existing Web checks.

At minimum:
- Web production build.
- Existing applicable Web tests.
- Typecheck/lint if supported by package.json.

Add focused tests for changed behavior where appropriate.

Do not create fragile tests for purely cosmetic CSS details.

### Responsive Verification

Check approximately:
- 375px — Mobile browser.
- 768px — Tablet.
- 1024px — Small desktop.
- 1440px — Desktop.

Verify:
- No horizontal overflow.
- Navigation remains usable.
- Chat composer remains accessible.
- Forms remain usable.
- Buttons do not overlap.
- Text truncation works.
- Empty/loading/error states render correctly.

If browser automation or visual inspection tools are unavailable, report that manual visual verification is pending.

Do not claim visual testing was performed without actually performing it.

## 18. Regression Checklist

Verify that the following still work:

- Authentication.
- Friend management.
- User search.
- Nearby.
- DIRECT messaging.
- GROUP messaging.
- Group creation and management.
- Group deletion.
- Conversation search.
- Conversation sorting.
- Latest-message previews.
- Message timestamps.
- Message sending.
- Smart scrolling.
- WebSocket updates.
- Unread badges.
- All/Unread filter.
- Mark-as-read behavior.
- Notifications.
- Profile and Settings.
- Logout.

Preserve Mobile compatibility.

## 19. Scope Protection

Do not implement:
- New Mobile UI.
- New Mobile features.
- Read receipts visible to other participants.
- Typing indicators.
- Message reactions.
- Message editing/deletion.
- File uploads.
- Voice/video calls.
- Full-text message search.
- Pinned/archived conversations.
- New Backend modules.
- New authentication architecture.
- New WebSocket architecture.
- Large-scale frontend rewrites.
- Unnecessary new UI dependencies.

Focus on improving existing UI/UX only.

## 20. Acceptance Criteria

PROMPT_031 is complete when:

- [ ] Existing UI inconsistencies have been identified and addressed.
- [ ] Web navigation is visually consistent.
- [ ] Messages UI is more readable and polished.
- [ ] Unread indicators remain correct.
- [ ] Friends, Nearby, Notifications, Profile, and Settings have been reviewed and improved where necessary.
- [ ] Responsive layouts work at the target viewport widths.
- [ ] No horizontal overflow or overlapping controls.
- [ ] Keyboard navigation and focus states remain usable.
- [ ] Existing Web functionality remains operational.
- [ ] Web build passes.
- [ ] Relevant Web tests pass.
- [ ] No unnecessary Backend changes.
- [ ] Mobile code remains unchanged.

## 21. Final Report

Provide a Vietnamese report containing:

1. UI/UX issues identified.
2. Improvements implemented.
3. Modified files.
4. Shared components or design tokens introduced.
5. Responsive improvements.
6. Accessibility improvements.
7. Performance considerations.
8. Web build and test results.
9. Regression verification results.
10. Manual visual checks actually performed.
11. Known limitations.
12. Suggested scope for PROMPT_032.

Clearly distinguish:
- Implemented and tested.
- Implemented but not visually verified.
- Not implemented.

End with exactly one of:

PROMPT_031 COMPLETE

or

PROMPT_031 NOT COMPLETE

Only report COMPLETE when all required acceptance criteria are satisfied.