ALTER TABLE conversation_participants
    ADD COLUMN last_read_message_id BIGINT,
    ADD COLUMN last_read_message_at TIMESTAMPTZ,
    ADD COLUMN read_state_version BIGINT NOT NULL DEFAULT 0,
    ADD CONSTRAINT chk_read_cursor_pair CHECK (
        (last_read_message_id IS NULL AND last_read_message_at IS NULL)
        OR (last_read_message_id IS NOT NULL AND last_read_message_at IS NOT NULL)
    );

CREATE INDEX idx_messages_conversation_read_order ON messages (conversation_id, created_at, id);
