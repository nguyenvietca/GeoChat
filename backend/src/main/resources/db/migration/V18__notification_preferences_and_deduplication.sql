CREATE TABLE notification_preferences (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    direct_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    group_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    friend_request_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    friend_acceptance_alerts BOOLEAN NOT NULL DEFAULT TRUE
);

DELETE FROM notifications older USING notifications newer
WHERE older.id < newer.id
  AND older.recipient_id = newer.recipient_id
  AND older.type = newer.type
  AND older.reference_id = newer.reference_id;

CREATE UNIQUE INDEX uq_notifications_recipient_event
    ON notifications(recipient_id, type, reference_id);
