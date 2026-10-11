ALTER TABLE messages ADD COLUMN reply_to_message_id BIGINT;
ALTER TABLE messages ADD COLUMN reaction_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE messages ADD CONSTRAINT fk_messages_reply
    FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON DELETE SET NULL;
CREATE INDEX idx_messages_reply ON messages(reply_to_message_id);

CREATE TABLE message_reactions (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_message_reaction UNIQUE (message_id, user_id, emoji),
    CONSTRAINT chk_message_reaction_emoji CHECK (emoji IN ('👍', '❤️', '😂', '😮', '😢', '😡'))
);
-- The unique index starts with message_id and serves batched summary lookups.
CREATE INDEX idx_message_reactions_user ON message_reactions(user_id);
