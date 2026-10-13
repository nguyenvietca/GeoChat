DROP INDEX IF EXISTS idx_messages_conversation_id_created_at;
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_id_desc
    ON messages (conversation_id, created_at DESC, id DESC);
