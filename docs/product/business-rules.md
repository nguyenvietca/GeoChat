# Business Rules

- Users with discoverability disabled should not appear in nearby listings.
- Nearby search combines location, radius, and discoverability filters.
- First-contact chat limit is capped at five messages per sender before connection is established.

- Web Search can start a direct conversation with any returned user without friendship or location sharing, through the discovery-chat endpoint. Nearby and shared-group entry points retain their existing contextual checks.
- A direct conversation started before friendship allows each participant to send five messages independently, including REST and WebSocket sends. Backend quota checks and inserts hold the conversation lock in one transaction. Once friendship is accepted, the same conversation becomes unrestricted; reopening through Friends is not required.

- Limited Web chats provide friendship actions in the chat itself: send a request when none exists, accept an incoming request, or wait for an outgoing request to be accepted. Only successful acceptance unlocks unrestricted messaging; sending a pending request does not remove the quota.

- Conversation unread state is persisted per participant. Messages sent by that participant are excluded. A read acknowledgement advances only through an existing message in an authorized conversation, using createdAt and message ID together, and never regresses.
- Web acknowledges read boundaries only while the selected chat is loaded, visible and focused, through the latest message considered viewed in its visible viewport. Hidden tabs and new messages outside the older-history reading region do not automatically mark those messages read. Conversation read state is private to the reader and does not expose read receipts to other participants.
