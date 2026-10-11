# PROMPT_036 — GeoChat Nearby Discovery & Map UX Improvements

## 1. Project Context

GeoChat is a location-based social messaging application.

Technology stack:
- Backend: Java 21, Spring Boot 4.1.0, Maven Wrapper.
- Database: PostgreSQL 16 + PostGIS.
- Security: JWT.
- Realtime: WebSocket/STOMP.
- Web: React, TypeScript, Vite.
- Architecture: Modular monolith.
- Mobile: Existing codebase, development postponed.

Previous milestones:
- PROMPT_027: Web Group Chat.
- PROMPT_028: Group Management and Conversation Synchronization.
- PROMPT_029: Web Messaging UX Enhancements.
- PROMPT_030: Unread Messages and Read State.
- PROMPT_031: Web UI/UX Polish.
- PROMPT_032: Theme, Micro-interactions and UX Quality.
- PROMPT_033: Typing Indicator and Online Presence.
- PROMPT_034: Message Reply, Emoji Reactions and Message Actions.
- PROMPT_035: Image Sharing and Attachment Preview.

Important:
Verify which milestones are actually implemented in the repository.

PROMPT_036 replaces the previously proposed Message Search milestone.

Do not implement Message Search in this prompt.

## 2. Primary Objective

Improve GeoChat's Nearby experience.

Users should be able to:
1. Discover other users nearby.
2. View nearby users in a list.
3. View nearby users on a map.
4. Filter users by distance.
5. Inspect limited public profile information.
6. Send friend requests when allowed.
7. Open an existing conversation when allowed.
8. Control whether they are discoverable.
9. Understand and manage location permissions.

The experience should feel like a real social discovery feature rather than a technical map demo.

Prioritize:
- Usability.
- Responsive design.
- Privacy.
- Performance.
- Existing API compatibility.

---

# PART A — MANDATORY RULES

## 3. Web-first Development

Focus on:
- Nearby page UI/UX.
- Map interaction.
- User discovery cards.
- Filtering.
- Responsive layout.
- Accessibility.
- Loading and error states.

Backend changes are allowed only when required to support these features.

## 4. Mobile — Strictly Excluded

- Do not modify Mobile source.
- Do not implement Mobile UI.
- Do not add Mobile features.
- Do not run Mobile build.
- Do not run Mobile typecheck.
- Do not run Mobile tests.

Preserve existing Mobile-facing APIs whenever reasonable.

## 5. Architecture Constraints

- Preserve the existing modular monolith.
- Reuse the location module.
- Reuse the friend module.
- Reuse the user module.
- Reuse existing chat APIs.
- Reuse existing PostGIS capabilities.
- Reuse existing map dependencies if available.
- Avoid unrelated refactoring.
- Avoid introducing new infrastructure unnecessarily.
- Do not add paid map services without explicit approval.

Do not create a separate Nearby microservice.

## 6. Production-oriented Implementation

Implement real functionality.

Do not:
- Hardcode fake nearby users.
- Return mock distances.
- Display fabricated online status.
- Introduce demo-only data.
- Store private location information in browser localStorage.
- Expose raw database coordinates to other users.
- Introduce continuous background location tracking.

Keep changes understandable for a developer learning through vibe coding.

---

# PART B — REPOSITORY AUDIT

## 7. Inspect Before Coding

Inspect the actual repository.

Backend:
1. Location entities.
2. Location controllers.
3. Location services.
4. Location repositories.
5. PostGIS queries.
6. Existing Nearby endpoints.
7. User profile DTOs.
8. Friend relationships.
9. Friend request APIs.
10. Existing blocking/privacy rules, if any.
11. Existing visibility settings.
12. Existing security configuration.
13. Flyway migrations.

Web:
1. Nearby page.
2. Map components.
3. Map library and tile provider.
4. Location permission handling.
5. Nearby API client.
6. Friend request UI.
7. Profile UI.
8. Chat navigation.
9. Existing design tokens.
10. Theme support.
11. Responsive layouts.
12. Existing tests.

Before coding, report:
- What Nearby functionality already exists.
- What location data is currently stored.
- How discovery visibility works.
- Whether the existing API exposes precise coordinates.
- Whether a map is already implemented.
- Which Backend changes are actually required.
- Proposed implementation phases.

Do not duplicate existing functionality.

---

# PART C — NEARBY DISCOVERY EXPERIENCE

## 8. Nearby Page Layout

Improve the existing Nearby page.

Desktop layout:
- Search/filter toolbar at the top.
- Nearby user list in a sidebar.
- Interactive map in the main content area.

Suggested desktop proportions:
- Sidebar: approximately 35%.
- Map: approximately 65%.

These proportions are flexible.

Tablet:
- Responsive split view where practical.

Mobile browser:
- Map/List toggle or stacked layout.
- Touch-friendly controls.
- No horizontal overflow.

Do not change the global navigation unnecessarily.

## 9. View Modes

Support:
- List View.
- Map View.

On desktop, a combined list/map layout is preferred when space permits.

On narrow screens, allow switching between views.

Preserve selected user and filters when switching views.

Do not reload data unnecessarily.

## 10. Nearby User Cards

Each card should show only permitted information.

Suggested:
- Avatar.
- Display name.
- Approximate distance.
- Friend relationship status.
- Available actions.

Possible actions:
- View profile.
- Add friend.
- Accept pending request, if applicable.
- Open existing conversation, if permitted.

Do not show:
- Exact latitude.
- Exact longitude.
- Home address.
- Exact movement history.
- Internal user identifiers as visible UI text.

Reuse existing profile and friendship components.

## 11. Friend Relationship States

Support existing relationship states.

Examples:
- Not friends.
- Friend request sent.
- Friend request received.
- Already friends.

Only implement states supported by the current Backend.

Do not invent new friendship semantics.

Actions must respect:
- Current friendship state.
- Existing privacy settings.
- Existing authorization rules.

After sending a request:
- Update the relevant card.
- Avoid unnecessary full-page reload.
- Show concise feedback.

## 12. Profile Navigation

Allow selecting a nearby user to view permitted profile information.

Reuse the existing profile component or route.

Do not create a second independent profile system.

Respect existing privacy rules.

Do not expose private fields merely because a user appears in Nearby.

## 13. Chat Navigation

If the selected user is already a friend and existing product rules allow messaging:
- Provide a Message action.
- Open the existing DIRECT conversation if available.
- Otherwise use the existing conversation creation/opening workflow.

Do not create duplicate DIRECT conversations.

Do not bypass friend or chat authorization.

If messaging non-friends is not supported, do not introduce it in this prompt.

---

# PART D — DISTANCE FILTERS

## 14. Radius Selection

Provide a distance filter.

Suggested options:
- 1 km.
- 3 km.
- 5 km.
- 10 km.

Use existing Backend-supported values if they differ.

Default:
5 km, unless the repository already defines another product default.

Do not hardcode distances in multiple components.

Keep filter options centralized.

## 15. Distance Calculation

Use PostGIS for distance filtering where available.

Requirements:
- Correct geographic distance units.
- Consistent meters/kilometers conversion.
- Bounded radius.
- No client-side filtering of an unrestricted user dataset.
- No unnecessary full-table scans.
- Use appropriate spatial indexes where justified.

Inspect the existing geographic column type.

Use the correct PostGIS functions for geography/geometry.

Do not assume geometry distance units are meters.

## 16. Approximate Distance Display

Show approximate distances.

Examples:
- Less than 1 km.
- About 2 km.
- About 5 km.

Avoid excessive precision.

Do not display:
- 124.37 meters.
- Exact coordinates.
- Exact address.

Use consistent distance formatting.

Do not expose more precision than the privacy model permits.

## 17. Filtering Behavior

When the user changes radius:
- Update Nearby results.
- Update map markers.
- Preserve current page layout.
- Show loading feedback.
- Avoid stale responses.
- Avoid duplicate requests.

Use request cancellation or request identity tracking where appropriate.

Do not continuously refetch without reason.

---

# PART E — MAP EXPERIENCE

## 18. Map Integration

Reuse the existing map library if present.

If no map library exists, choose a suitable open-source option consistent with the current stack.

Prefer:
- Leaflet with OpenStreetMap-compatible tiles, if appropriate.

Before adding dependencies:
- Inspect existing dependencies.
- Check compatibility.
- Avoid unnecessary packages.

Respect the selected map tile provider's usage policy and attribution requirements.

Do not assume public community tile servers are suitable for production traffic.

Document the tile provider and production deployment considerations.

## 19. Map Markers

Display nearby users using privacy-preserving map markers.

Requirements:
- Markers are clickable.
- Selected marker highlights the corresponding user card.
- Selected card highlights the corresponding marker.
- Map remains responsive.
- Marker interactions work on touch screens.

Do not plot exact user coordinates obtained from private Backend storage.

Important:
Do not assume that rounding latitude/longitude is sufficient to protect user location.

Implement a deliberate privacy-preserving representation.

## 20. Privacy-preserving Map Positions

The Backend must not return exact coordinates of other users through Nearby discovery.

Choose a privacy model that does not allow clients to reconstruct exact locations through repeated searches.

Possible approaches:
- Coarse geographic cells.
- Stable approximate area markers.
- Aggregated user counts by area.
- Other existing privacy-preserving location representations.

Prefer aggregated area markers when individual approximate markers could reveal sensitive locations.

Do not use per-request random jitter as the only protection.

Do not expose raw coordinates in:
- REST responses.
- WebSocket payloads.
- Browser console logs.
- Debug attributes.
- Map marker metadata.

Document the chosen privacy model and its limitations.

## 21. Map Center

If the user grants location permission:
- Center the map near their current location.
- Display their own location distinctly.
- Avoid exposing it to other users.

If permission is denied:
- Show an explanatory state.
- Provide a retry action.
- Do not invent a current location.

Do not automatically fall back to a fabricated GPS coordinate.

If the application already supports a manually selected search area, reuse it.

## 22. Map Interaction

Support:
- Zoom.
- Pan.
- Select marker.
- Select nearby user.
- Fit visible markers where appropriate.

Avoid:
- Constant map recentering.
- Excessive animations.
- Reinitializing the map on every filter change.
- Unnecessary network requests on every minor pan.

Do not automatically expand discovery radius beyond the user's selected limit.

## 23. Empty Map State

When no nearby users are found:
- Show a clear empty state.
- Explain that no discoverable users were found within the selected radius.
- Allow changing the radius.
- Keep the map functional.

Do not show fake markers.

---

# PART F — LOCATION PRIVACY

## 24. Privacy Principles

Location is sensitive user information.

Nearby discovery must be:
- Explicitly controlled by the user.
- Limited to authorized use.
- Understandable.
- Reversible.
- Conservative by default.

Do not expose exact user coordinates.

Do not assume permission to access device location means permission to publish it to other users.

These are separate permissions.

## 25. Discoverability Setting

Inspect existing privacy settings.

If discoverability already exists:
- Reuse it.

If missing:
- Implement a minimal opt-in setting.

Suggested:
"Allow others to discover me nearby"

Default:
Off for newly introduced discoverability behavior.

Requirements:
- Persist the user's choice.
- Allow disabling at any time.
- Apply the setting on the Backend.
- Exclude opted-out users from discovery.
- Do not rely only on frontend filtering.

Avoid automatically enabling discovery for existing users.

## 26. Location Permission States

Handle:
- Permission not requested.
- Permission granted.
- Permission denied.
- Permission unavailable.
- Location request timed out.
- Browser does not support geolocation.

Provide clear user-facing messages.

Do not repeatedly trigger browser permission prompts.

Request location only when needed for an explicit user action or an already-authorized workflow.

## 27. Location Freshness

Inspect existing location timestamps.

Avoid showing stale location data as current.

If the application already tracks location freshness:
- Reuse it.

Otherwise:
- Define a conservative freshness policy.
- Exclude stale locations from active Nearby discovery.
- Avoid unnecessary database migrations.

Do not imply users are physically present at an old recorded location.

## 28. Blocking and Privacy Rules

If user blocking exists:
- Blocked users must not discover each other through Nearby when required by the existing privacy policy.

If blocking does not exist:
- Do not implement an entire blocking system in this milestone.
- Document the gap.

Do not bypass existing privacy rules.

## 29. Location Update Behavior

Reuse existing location update APIs.

Do not:
- Add continuous background GPS tracking.
- Add high-frequency location polling.
- Track location when Nearby is not in use.
- Store browser GPS coordinates in localStorage.

Use a controlled location refresh workflow.

If automatic refresh is already implemented:
- Review its frequency.
- Review cleanup.
- Review consent.
- Avoid duplicate timers.

---

# PART G — BACKEND REQUIREMENTS

## 30. Nearby API

Reuse the existing Nearby API if possible.

If extensions are needed, preserve compatibility.

Suggested request information:
- Search center or authorized current location.
- Radius.
- Pagination parameters.

Suggested response information:
- Public user ID.
- Display name.
- Avatar reference.
- Approximate distance band.
- Friendship status.
- Privacy-safe map area or marker reference.

Do not expose exact coordinates of other users.

Avoid introducing a second incompatible Nearby API without a clear reason.

## 31. Authorization

Enforce:
- JWT authentication.
- User privacy settings.
- Discovery visibility.
- Valid radius.
- Valid search coordinates.
- Valid pagination.
- Existing blocking rules if present.

Never trust client-provided user IDs for authorization.

Do not allow an unauthenticated user to enumerate Nearby profiles.

## 32. Enumeration and Abuse Protection

Nearby discovery can be abused to track or enumerate users.

Review:
- Request rate limiting.
- Maximum radius.
- Maximum result count.
- Pagination limits.
- Repeated location queries.
- Precise distance exposure.

Implement reasonable safeguards within existing infrastructure.

Do not introduce Redis solely for rate limiting.

Document limitations of process-local protections.

## 33. PostGIS Query Optimization

Inspect existing spatial indexes.

Prefer efficient radius queries.

Consider:
- ST_DWithin.
- ST_Distance.
- Existing geography indexes.
- Appropriate filtering before sorting.

Use the correct SRID and units.

Avoid computing distance for every user unnecessarily.

Do not introduce expensive schema changes without evidence.

## 34. Database Migrations

Create a new Flyway migration only if required.

Possible reasons:
- Missing discoverability setting.
- Missing location freshness field.
- Missing necessary index.

Requirements:
- Do not modify applied migrations.
- Preserve existing data.
- Preserve Mobile compatibility.
- Use safe defaults.
- Document migration purpose.

Do not create unnecessary tables.

---

# PART H — UI/UX QUALITY

## 35. Loading States

Provide:
- Initial loading.
- Radius-change loading.
- Location request loading.
- Friend request processing.

Use subtle feedback.

Avoid full-page flicker.

## 36. Empty States

Handle:
- No nearby users.
- Location permission denied.
- Discoverability disabled.
- No location available.
- Network unavailable.

Each state should explain the situation and provide a relevant action.

Do not use generic "Something went wrong" messages for every case.

## 37. Error Handling

Handle:
- Geolocation timeout.
- Invalid coordinates.
- Network failure.
- Unauthorized request.
- Expired session.
- Backend validation error.
- Friend request conflict.

Avoid raw error messages.

Do not log private location data unnecessarily.

## 38. Theme Compatibility

Support:
- Light.
- Dark.
- System theme.

Ensure:
- Map controls remain visible.
- User cards remain readable.
- Selected markers are distinguishable.
- Filters have adequate contrast.
- Empty states remain consistent.

Reuse existing design tokens.

## 39. Responsive Design

Verify:
- 375px.
- 768px.
- 1440px.

Requirements:
- No horizontal overflow.
- No clipped controls.
- No overlapping cards.
- Map remains usable.
- Filters remain accessible.
- Touch targets are large enough.

Do not implement Native Mobile UI.

## 40. Accessibility

Requirements:
- Accessible filter labels.
- Keyboard-operable controls.
- Visible focus states.
- Accessible friend request buttons.
- Meaningful map alternative through List View.
- No color-only relationship indicators.
- Reduced-motion support.
- Clear loading announcements where appropriate.

The list must remain usable even when the map cannot be operated with assistive technology.

---

# PART I — TESTING

## 41. Backend Tests

Test:
1. Authorized Nearby request.
2. Unauthorized Nearby request.
3. Radius validation.
4. Invalid coordinates.
5. Correct distance filtering.
6. Results outside radius excluded.
7. Current user excluded from results.
8. Opted-out users excluded.
9. Newly introduced discoverability defaults to off.
10. Stale locations excluded.
11. Removed/deleted users excluded.
12. Blocking rules if present.
13. Pagination correctness.
14. Result count limits.
15. Friend relationship state.
16. No precise coordinates in responses.
17. Privacy-safe marker representation.
18. Repeated-query privacy behavior.
19. Spatial query correctness.
20. Existing Mobile API compatibility.

## 42. Web Tests

Test:
1. Nearby page loads.
2. List View.
3. Map View.
4. Radius selection.
5. Filter changes.
6. Loading state.
7. Empty state.
8. Location permission denied.
9. Location timeout.
10. Discoverability toggle.
11. User card selection.
12. Map marker selection.
13. Friend request.
14. Friend request state update.
15. Profile navigation.
16. Chat navigation.
17. Stale request handling.
18. Conversation functionality unaffected.
19. Light/Dark themes.
20. Responsive layout.

## 43. Manual Verification

Use at least two test accounts with explicitly configured test locations.

Scenario A — Nearby Discovery:
- Account A enables discoverability.
- Account B searches nearby.
- A appears only when eligible.

Scenario B — Privacy:
- A disables discoverability.
- B refreshes Nearby.
- A no longer appears.

Scenario C — Radius:
- Change radius from 1 km to 5 km.
- Verify results follow actual distance filtering.

Scenario D — Map/List:
- Select a user in the list.
- Verify the corresponding map representation is selected.
- Select a map marker or area.
- Verify appropriate list behavior.

Scenario E — Friendship:
- Send a friend request.
- Verify the card updates.
- Verify existing friendship rules remain intact.

Scenario F — Permissions:
- Deny browser location permission.
- Verify the page displays a useful explanation.
- Verify no fabricated location is used.

Scenario G — Responsive:
- Test 375px.
- Test 768px.
- Test 1440px.
- Verify list, map, filters and actions.

## 44. Regression Checklist

Verify:
- Authentication.
- Logout.
- Friends.
- Friend requests.
- User profiles.
- DIRECT chat.
- GROUP chat.
- Group management.
- Group deletion.
- Message sending.
- Unread counts.
- Typing Indicator.
- Online Presence.
- Reply/Reactions if implemented.
- Image sharing if implemented.
- Notifications.
- Theme switching.
- Responsive navigation.

Do not run Mobile tests.

## 45. Validation

Inspect repository scripts.

Run:
- Web production build.
- Existing Web tests.
- Web typecheck/lint if available.
- Relevant Backend tests via Maven Wrapper.

If a Flyway migration is introduced, validate it against PostgreSQL/PostGIS.

Do not claim manual browser testing unless actually performed.

Report real command results.

---

# PART J — IMPLEMENTATION PHASES

## 46. Phase 1 — Architecture Audit

- Inspect existing Nearby implementation.
- Inspect PostGIS schema.
- Inspect privacy settings.
- Inspect Web map dependencies.
- Identify gaps.
- Propose minimal changes.

## 47. Phase 2 — Privacy and Backend

- Reuse or implement discoverability control.
- Enforce location freshness.
- Secure Nearby results.
- Implement privacy-safe map representation.
- Improve distance filtering if needed.
- Add Backend tests.

## 48. Phase 3 — Nearby UI

- Improve Nearby layout.
- Add List/Map modes.
- Add radius filters.
- Add user cards.
- Add selection synchronization.
- Add loading/empty/error states.
- Add Web tests.

## 49. Phase 4 — Social Actions

- Integrate friend requests.
- Integrate profile navigation.
- Integrate chat navigation.
- Handle relationship state changes.
- Add tests.

## 50. Phase 5 — Quality and Regression

- Verify location privacy.
- Verify authorization.
- Verify spatial filtering.
- Verify responsive layouts.
- Verify accessibility.
- Run Backend and Web tests.
- Document limitations.

Complete each phase before moving to the next.

---

# PART K — ACCEPTANCE CRITERIA

## 51. Completion Checklist

PROMPT_036 is complete when:

- [ ] Nearby works with real Backend data.
- [ ] List View works.
- [ ] Map View works.
- [ ] Radius filtering works.
- [ ] PostGIS distance calculations are correct.
- [ ] Nearby user cards display permitted information.
- [ ] Friend relationship states are correct.
- [ ] Friend request integration works.
- [ ] Profile navigation works.
- [ ] Chat navigation follows existing permissions.
- [ ] Discoverability is user-controlled.
- [ ] Opted-out users are excluded.
- [ ] Stale locations are handled.
- [ ] Exact coordinates of other users are not exposed.
- [ ] Map markers respect the privacy model.
- [ ] Location permission errors are handled.
- [ ] Loading/empty/error states are implemented.
- [ ] Light/Dark themes work.
- [ ] Responsive layouts work.
- [ ] Relevant Backend tests pass.
- [ ] Web build and tests pass.
- [ ] Existing chat functionality remains operational.
- [ ] Mobile code remains unchanged.

## 52. Final Report

Provide a Vietnamese report containing:

1. Existing Nearby architecture.
2. Features reused.
3. New Backend functionality.
4. Database migrations.
5. PostGIS query strategy.
6. Location privacy decisions.
7. Map implementation.
8. Nearby UI improvements.
9. Friend/profile/chat integration.
10. Files modified.
11. Backend test results.
12. Web build/test results.
13. Manual verification actually performed.
14. Regression results.
15. Known limitations.
16. Recommended next milestone.

Clearly distinguish:
- Implemented and tested.
- Implemented but not manually verified.
- Not implemented.

End with exactly one of:

PROMPT_036 COMPLETE

or

PROMPT_036 NOT COMPLETE

Only report COMPLETE when all required acceptance criteria have passed.