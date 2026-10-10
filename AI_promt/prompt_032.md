# PROMPT_032 — GeoChat Web Theme System, Micro-interactions & UX Quality

## 1. Project Context

GeoChat is a location-based social messaging application supporting Web and Mobile clients.

Technology stack:
- Backend: Java 21, Spring Boot 4.1.0, Maven Wrapper.
- Database: PostgreSQL, PostGIS, Flyway.
- Authentication: JWT.
- Realtime: WebSocket/STOMP.
- Web: React, TypeScript, Vite.
- Architecture: Modular monolith.
- Mobile: Existing codebase, development postponed.

Previous milestones:
- PROMPT_027: Web Group Chat and Messages Layout.
- PROMPT_028: Web Group Management and Conversation Synchronization.
- PROMPT_029: Web Messaging UX Enhancements.
- PROMPT_030: Unread Messages and Read State.
- PROMPT_031: Web UI/UX Polish and Responsive Improvements.

PROMPT_030 is confirmed complete.

PROMPT_031 is the intended preceding milestone; inspect the actual repository to determine which PROMPT_031 improvements are present. Do not assume they were all completed.

This prompt combines the previously planned PROMPT_032, PROMPT_033, and PROMPT_034 into one consolidated milestone.

Main objectives:
1. Implement or improve Light/Dark/System theme support.
2. Add subtle, consistent micro-interactions.
3. Improve accessibility and keyboard usability.
4. Improve loading, empty, error, and feedback states.
5. Improve responsive quality and visual consistency.
6. Preserve all existing functionality and performance optimizations.

This is a Web-first UI/UX improvement milestone, not a feature expansion or architecture rewrite.

---

## 2. Mandatory Development Rules

### Web — Primary Focus

Prioritize:
- UI/UX quality.
- Responsive design.
- Theme consistency.
- Smooth interactions.
- Accessibility.
- User feedback.
- Performance and stability.

### Backend — Avoid Changes

Do not modify Backend unless a critical issue makes a requested improvement impossible.

Do not introduce new APIs for theme preferences.

Theme preferences should remain client-side for this milestone.

### Mobile — Strictly Excluded

- Do not modify Mobile code.
- Do not implement Mobile UI.
- Do not add Mobile features.
- Do not run Mobile build.
- Do not run Mobile typecheck.
- Do not run Mobile tests.
- Do not delete existing Mobile code.

Preserve existing API compatibility with Mobile.

### Architecture

- Preserve existing routes.
- Preserve REST API contracts.
- Preserve WebSocket/STOMP behavior.
- Preserve authentication.
- Preserve existing state management.
- Avoid unnecessary dependencies.
- Avoid unrelated refactoring.
- Do not replace the existing styling framework.

---

## 3. Inspect Before Coding

Before implementation, inspect the actual Web codebase.

Review:
1. Application entry point.
2. Main layout and navigation.
3. Existing global CSS.
4. Theme variables or design tokens.
5. Existing ThemeProvider or equivalent, if any.
6. MessagesPage and related components.
7. Conversation sidebar.
8. Chat header and message bubbles.
9. Message composer.
10. Friends page.
11. Nearby page.
12. Notifications.
13. Profile and Settings.
14. Dialogs, dropdowns, toasts, and forms.
15. Existing responsive breakpoints.
16. Existing Web test setup.
17. Existing UI/UX improvements from PROMPT_031.

Identify which requirements already exist.

Do not duplicate working functionality.

Before coding, provide a short audit:
- Existing theme support.
- Current styling approach.
- Components requiring theme improvements.
- Interaction inconsistencies.
- Accessibility issues.
- Responsive issues.
- Files expected to change.

Then implement the improvements incrementally.

---

# PART A — LIGHT / DARK / SYSTEM THEME

## 4. Theme Modes

Support three theme preferences:

- Light
- Dark
- System

Expected behavior:

Light:
- Always use the light theme.

Dark:
- Always use the dark theme.

System:
- Follow the operating system's color scheme preference.

Default behavior:
- Use the existing saved preference if valid.
- Otherwise default to System.

If the application already has a working theme system, extend it rather than replacing it.

## 5. Theme Preference Persistence

Persist the selected preference in localStorage.

Suggested key:
geochat-theme

Suggested values:
light
dark
system

Requirements:
- Preference survives page refresh.
- Preference survives navigation.
- Invalid stored values fall back safely to System.
- System mode responds to operating system theme changes.
- Explicit Light/Dark selections are not overridden by OS changes.
- Storage access failures do not crash the application.
- Theme changes do not require Backend requests.

Do not store the theme preference in JWT or user profile APIs.

## 6. Prevent Theme Flash

Avoid a visible flash of the incorrect theme during initial page loading.

Implement a small, safe theme initialization strategy consistent with the existing Vite application.

Requirements:
- Resolve the initial theme before the main UI becomes visible when practical.
- Avoid unnecessary React rerenders.
- Avoid hydration assumptions if the application uses client-side rendering only.
- Do not block rendering on asynchronous API requests.
- Preserve compatibility with the existing application entry point.

Use a data-theme attribute or equivalent existing mechanism.

Do not create multiple competing theme initialization systems.

## 7. Design Tokens

Prefer semantic CSS variables rather than hardcoded colors throughout components.

Suggested semantic tokens:

Colors:
- --color-bg
- --color-surface
- --color-surface-hover
- --color-surface-active
- --color-text
- --color-text-muted
- --color-border
- --color-primary
- --color-primary-hover
- --color-danger
- --color-success
- --color-focus

Optional tokens:
- --shadow-sm
- --shadow-md
- --radius-sm
- --radius-md
- --radius-lg
- --transition-fast
- --transition-normal

These are examples only.

Reuse existing variables and naming conventions when available.

Do not rename the entire existing design-token system unnecessarily.

Use appropriate semantic colors for both themes.

Avoid simply inverting all colors.

## 8. Dark Theme Visual Quality

Dark mode should use comfortable dark surfaces rather than pure black everywhere.

Ensure:
- Clear distinction between page background and cards.
- Readable primary and secondary text.
- Visible borders and separators.
- Consistent button colors.
- Clear selected and hover states.
- Appropriate message bubble contrast.
- Readable timestamps.
- Visible unread badges.
- Accessible form controls.
- Readable dropdown menus.
- Proper modal and toast styling.

Do not use hardcoded white backgrounds that break Dark Mode.

Avoid overly bright shadows and unnecessary gradients.

## 9. Theme Settings UI

Add or improve the theme preference control in the existing Settings page.

Options:
- Light
- Dark
- System

Requirements:
- Show the current selected preference.
- Apply changes immediately.
- Persist changes.
- Provide accessible labels.
- Follow existing Settings design conventions.
- Work on desktop and mobile browsers.

A compact segmented control, radio group, or select is acceptable.

Choose the control that best fits the current design.

Do not create a new Settings page.

## 10. Theme Coverage

Verify theme consistency across:

- Login and registration.
- Main application layout.
- Navigation.
- Messages.
- Conversation list.
- Search and unread filters.
- Chat header.
- Message bubbles.
- Message composer.
- Friends.
- Nearby.
- Notifications.
- Profile.
- Settings.
- Group management dialogs.
- Dropdowns.
- Modals.
- Toasts.
- Empty states.
- Loading states.
- Error states.

If third-party components such as maps are present, inspect their theme support.

Do not replace third-party libraries solely to add dark styling.

---

# PART B — MICRO-INTERACTIONS

## 11. Interaction Design Principles

Introduce subtle and consistent micro-interactions.

Goals:
- Make actions feel responsive.
- Improve clarity.
- Provide useful feedback.
- Avoid visual noise.
- Preserve performance.

Recommended transition duration:
- Fast interactions: approximately 100–150ms.
- Normal interactions: approximately 150–250ms.

These values are guidelines, not strict requirements.

Do not add animation solely for decoration.

Prefer CSS transitions over JavaScript animation libraries.

Do not install Framer Motion or another animation framework unless the existing project already uses it and it is appropriate.

## 12. Buttons and Interactive Controls

Improve existing buttons and controls.

Expected states:
- Default.
- Hover.
- Active/pressed.
- Focus-visible.
- Disabled.
- Loading, where applicable.

Requirements:
- Clear visual feedback.
- Consistent border radius.
- Consistent padding.
- No unexpected layout shifts.
- Disabled controls remain understandable.
- Loading indicators do not cause button-width jumps.

Avoid hover effects that move surrounding elements.

Do not animate every button with unnecessary scaling.

## 13. Navigation Interactions

Improve navigation feedback.

Requirements:
- Active route is clearly identifiable.
- Hover states are subtle.
- Keyboard focus remains visible.
- Navigation transitions do not reload the page.
- Sidebar behavior remains predictable.
- No unnecessary full-page animations.

Preserve existing routing.

Do not change route paths.

## 14. Conversation List Interactions

Improve existing conversation list feedback.

Requirements:
- Smooth hover states.
- Clear selected conversation state.
- Clear unread conversation emphasis.
- Stable unread badge position.
- No layout jump when unread counts change.
- Consistent avatar alignment.
- Stable timestamps and previews.

Do not animate conversation sorting in a way that causes confusion.

Preserve:
- Conversation search.
- Sorting.
- Latest-message preview.
- All/Unread filter.
- Realtime updates.
- Group deletion synchronization.

## 15. Chat Interactions

Improve the existing chat experience without changing messaging logic.

Possible improvements:
- Subtle message appearance transitions.
- Clear composer focus styling.
- Smooth Send button state transitions.
- Stable sending indicators.
- Consistent retry feedback.
- Clear Jump to latest action.

Important:
- Do not replay entrance animations for all messages when switching conversations.
- Do not animate historical message pagination unnecessarily.
- Do not trigger scroll jumps.
- Do not duplicate messages.
- Do not modify message ordering.
- Do not interfere with smart scrolling.
- Do not interfere with Vietnamese IME input.

Preserve existing Enter and Shift+Enter behavior.

Avoid animations that cause scrollHeight changes after the scroll position has been calculated.

## 16. Dialogs, Menus and Toasts

Review existing:
- Dialogs.
- Dropdown menus.
- Context menus.
- Toast notifications.
- Confirmation actions.

Improve:
- Open/close visual feedback.
- Overlay appearance.
- Focus indication.
- Loading feedback.
- Error feedback.
- Button consistency.

Requirements:
- Dialogs remain keyboard accessible.
- Escape closes dismissible dialogs where appropriate.
- Focus returns to the triggering element when possible.
- Destructive actions remain clearly identified.
- Do not close a dialog before a required operation succeeds unless existing behavior intentionally supports it.

Avoid complex animation choreography.

---

# PART C — ACCESSIBILITY

## 17. Semantic HTML

Review interactive UI components.

Use appropriate HTML semantics:
- button for actions.
- a or router links for navigation.
- label for form controls.
- Appropriate headings.
- Meaningful accessible names.

Avoid clickable div elements when a semantic button is appropriate.

Do not add unnecessary ARIA attributes where native HTML semantics are sufficient.

## 18. Keyboard Navigation

Ensure important functionality is keyboard accessible.

Verify:
- Main navigation.
- Conversation search.
- All/Unread filter.
- Conversation selection.
- Message composer.
- Send button.
- Group management actions.
- Settings controls.
- Dialogs and dropdowns.

Requirements:
- Visible keyboard focus.
- Predictable tab order.
- No keyboard traps.
- Escape behavior where appropriate.
- Focus management for dialogs.
- Focus restoration after closing dialogs.

Do not introduce global keyboard shortcuts that interfere with text input.

## 19. Color Contrast

Review text and control contrast in both themes.

Target WCAG AA contrast where practical:
- Normal text: at least 4.5:1.
- Large text: at least 3:1.
- Important non-text UI indicators: at least 3:1 where applicable.

Check:
- Primary text.
- Muted text.
- Placeholder text.
- Button labels.
- Unread badges.
- Error messages.
- Form borders.
- Focus indicators.

Do not communicate important states using color alone.

## 20. Reduced Motion

Respect:

prefers-reduced-motion: reduce

When reduced motion is enabled:
- Disable nonessential entrance animations.
- Minimize decorative transitions.
- Avoid unnecessary smooth scrolling.
- Preserve essential interaction feedback.

Do not remove useful focus indicators or loading feedback.

## 21. Screen Reader Improvements

Improve accessible names and announcements.

Examples:
- Unread count labels.
- Search input labels.
- Theme selection labels.
- Icon-only buttons.
- Error messages.
- Loading states.

For dynamic chat updates:
- Avoid announcing entire message histories repeatedly.
- Avoid excessive live-region announcements.
- Do not make every realtime event intrusive.

Use aria-live only where appropriate.

---

# PART D — UX QUALITY

## 22. Loading States

Review existing loading states across Web pages.

Improve where necessary:
- Initial page loading.
- Conversation loading.
- Message history loading.
- Friend list loading.
- Nearby data loading.
- Notifications loading.
- Profile loading.

Requirements:
- Consistent visual language.
- No unnecessary global spinner.
- No flicker during ordinary navigation.
- Stable layout dimensions.
- Clear indication when a meaningful operation is pending.

Use skeleton loading only where it genuinely improves perceived performance.

Do not introduce skeletons everywhere.

## 23. Empty States

Review empty states.

Examples:
- No conversations.
- No unread conversations.
- No search matches.
- Empty group.
- No friends.
- No friend requests.
- No notifications.
- No nearby users.

Each empty state should:
- Explain the current situation.
- Use concise language.
- Provide a relevant action when appropriate.
- Match the current theme.
- Work on narrow screens.

Do not add unnecessary illustrations or dependencies.

## 24. Error States

Review common error handling.

Requirements:
- Human-readable messages.
- Appropriate retry actions.
- No raw stack traces in UI.
- No sensitive internal information.
- Consistent error styling.
- Preserve user input after recoverable failures.

Important cases:
- Network failure.
- Message sending failure.
- Failed conversation loading.
- Failed friend request.
- Failed group operation.
- Location permission denied.
- Session expiration.

Do not change existing authentication architecture.

## 25. Form UX

Review forms on:
- Login.
- Registration.
- Profile.
- Settings.
- Group creation and editing.

Improve:
- Label readability.
- Validation feedback.
- Required field indication.
- Disabled/loading states.
- Error placement.
- Keyboard usability.
- Responsive spacing.

Avoid clearing form values after failed submissions.

Do not change existing validation business rules unnecessarily.

## 26. Responsive Quality

Verify at approximately:
- 320px.
- 375px.
- 768px.
- 1024px.
- 1440px.

Requirements:
- No unwanted horizontal overflow.
- No overlapping navigation.
- No clipped controls.
- No unread badge overlap.
- No hidden Send button.
- No inaccessible dialogs.
- No oversized fixed-width components.
- No unreadable message bubbles.
- No broken theme selector.

Handle browser zoom reasonably, including 200% zoom where practical.

Preserve existing responsive Messages navigation.

Do not implement Native Mobile UI.

## 27. Performance & Stability

Preserve all improvements from PROMPT_028 through PROMPT_031.

Critical requirements:
- No unnecessary conversation-list reload.
- No unstable navigation effect dependencies.
- No repeated full friend-list fetching during chat switching.
- No N+1 group requests.
- No duplicate WebSocket subscriptions.
- No duplicate messages.
- No unread-count regression.
- No accidental mark-read behavior.
- No chat-header flicker.
- No scroll-position regression.
- No unnecessary rerender loops.

Theme changes must not:
- Remount the entire application.
- Reset authentication.
- Reset selected conversation.
- Reset unsent drafts.
- Reconnect WebSocket unnecessarily.
- Reload conversation data.

Use simple CSS transitions.

Avoid expensive animations involving large layout recalculations.

---

# PART E — TESTING & VALIDATION

## 28. Theme Tests

Use the existing Web testing framework.

Test:
1. Default theme preference.
2. Light selection.
3. Dark selection.
4. System selection.
5. localStorage persistence.
6. Invalid stored preference.
7. OS theme change while using System.
8. OS theme change while using explicit Light/Dark.
9. Theme persistence after navigation.
10. Theme persistence after refresh.
11. Theme initialization fallback when storage is unavailable.
12. Theme switching without application remount.

Do not create a new testing framework unnecessarily.

## 29. Interaction Tests

Cover relevant behavior:
- Button loading states.
- Disabled controls.
- Keyboard navigation.
- Dialog open/close.
- Escape handling.
- Focus restoration.
- Form error feedback.
- Message composer behavior.
- Reduced-motion behavior where testable.

Prefer behavioral tests over fragile CSS timing assertions.

## 30. Manual Visual Verification

Verify Light and Dark themes across:
- Login/Register.
- Messages.
- Friends.
- Nearby.
- Notifications.
- Profile.
- Settings.
- Group dialogs.

Check:
- Readability.
- Contrast.
- Hover/focus states.
- Dropdown styling.
- Modal styling.
- Loading states.
- Empty states.
- Error states.
- Responsive behavior.

Use browser automation or visual inspection if available.

If actual browser testing is unavailable, clearly report manual verification as pending.

Do not claim visual verification was performed without executing it.

## 31. Regression Checklist

Verify:
- Authentication.
- Logout.
- Friend management.
- User search.
- Nearby.
- DIRECT messaging.
- GROUP messaging.
- Group creation.
- Group renaming.
- Add/remove members.
- Leave group.
- Delete group.
- GROUP_DELETED synchronization.
- Conversation search.
- Conversation sorting.
- Latest-message preview.
- Message timestamps.
- Message sending.
- Sending failure and retry.
- Smart scrolling.
- WebSocket realtime updates.
- Unread badges.
- All/Unread filtering.
- Mark-as-read behavior.
- Hidden-tab unread behavior.
- Notifications.
- Profile.
- Settings.

Do not modify Backend or Mobile just to satisfy frontend visual tests.

## 32. Validation Commands

Inspect package.json and use the actual scripts available.

At minimum, run:

npm run build

Run existing:
- Web tests.
- Lint.
- Typecheck.

Only run commands supported by the repository.

Do not run Mobile build, typecheck, or tests.

Do not run unrelated Backend tests when Backend is unchanged.

Report actual command outputs and failures.

---

# PART F — IMPLEMENTATION STRATEGY

## 33. Implementation Order

Implement in small, reviewable phases.

### Phase 1 — Theme Foundation
- Audit current CSS and theme.
- Implement or extend theme tokens.
- Add Light/Dark/System preference.
- Add persistence.
- Prevent theme flash.

### Phase 2 — Theme Coverage
- Apply theme tokens across main layout.
- Update Messages.
- Update Friends, Nearby, Notifications.
- Update Profile, Settings, forms and dialogs.

### Phase 3 — Micro-interactions
- Improve hover/focus/active states.
- Improve navigation feedback.
- Improve chat interaction feedback.
- Improve dialog and toast transitions.
- Add reduced-motion handling.

### Phase 4 — Accessibility & UX Quality
- Improve semantic HTML.
- Improve keyboard navigation.
- Improve contrast.
- Improve loading, empty, and error states.
- Fix responsive issues.

### Phase 5 — Testing & Regression
- Run Web checks.
- Test theme behavior.
- Verify important interactions.
- Check responsive layouts.
- Verify existing chat and unread behavior.

Do not begin unrelated features during these phases.

Do not rewrite the entire frontend.

Keep each phase focused and maintainable.

## 34. Acceptance Criteria

PROMPT_032 is complete when:

- [ ] Light/Dark/System themes work.
- [ ] Theme preference persists after refresh.
- [ ] System theme responds to OS changes.
- [ ] No significant incorrect-theme flash on initial load.
- [ ] Major Web screens support both themes.
- [ ] Dialogs, dropdowns, toasts, and forms are theme-consistent.
- [ ] Hover, focus, active, and disabled states are consistent.
- [ ] Micro-interactions are subtle and do not cause layout shifts.
- [ ] Reduced-motion preference is respected.
- [ ] Important controls are keyboard accessible.
- [ ] Contrast issues identified during review are addressed.
- [ ] Loading, empty, and error states are understandable.
- [ ] Responsive layouts work at target viewport widths.
- [ ] No unnecessary horizontal overflow.
- [ ] Existing chat functionality remains operational.
- [ ] Unread counts and mark-read behavior remain correct.
- [ ] Theme switching does not reset chat state.
- [ ] Web build passes.
- [ ] Relevant Web tests pass.
- [ ] Backend APIs remain unchanged unless explicitly justified.
- [ ] Mobile code remains untouched.

## 35. Final Report

Provide a report in Vietnamese containing:

1. Initial UI/UX audit.
2. Theme system implementation.
3. Design tokens introduced or reused.
4. Theme coverage by screen.
5. Micro-interactions implemented.
6. Accessibility improvements.
7. Loading/empty/error improvements.
8. Responsive fixes.
9. Files changed.
10. Dependencies added, if any, and justification.
11. Web build results.
12. Web test/lint/typecheck results.
13. Regression verification.
14. Manual visual checks actually performed.
15. Known limitations.
16. Suggested next development milestone.

Clearly distinguish:
- Implemented and tested.
- Implemented but not visually verified.
- Not implemented.

End with exactly one of:

PROMPT_032 COMPLETE

or

PROMPT_032 NOT COMPLETE

Only report COMPLETE when all required acceptance criteria have passed.

Do not mark the prompt complete based solely on a successful build.