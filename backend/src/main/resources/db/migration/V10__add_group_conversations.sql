ALTER TABLE conversations
    DROP CONSTRAINT IF EXISTS chk_conversations_type;

ALTER TABLE conversations
    ADD COLUMN group_name VARCHAR(100),
    ADD COLUMN owner_id BIGINT;

ALTER TABLE conversations
    ADD CONSTRAINT chk_conversations_type CHECK (
        (type = 'DIRECT' AND group_name IS NULL AND owner_id IS NULL)
        OR (type = 'GROUP' AND group_name IS NOT NULL AND BTRIM(group_name) <> '' AND owner_id IS NOT NULL)
    ),
    ADD CONSTRAINT fk_conversations_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE conversation_participants
    ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'MEMBER',
    ADD CONSTRAINT chk_conversation_participants_role CHECK (role IN ('OWNER', 'MEMBER'));

CREATE INDEX idx_conversations_owner_id ON conversations (owner_id);