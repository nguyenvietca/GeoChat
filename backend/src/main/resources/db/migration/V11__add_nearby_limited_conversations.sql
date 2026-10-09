ALTER TABLE conversations 
    DROP CONSTRAINT IF EXISTS chk_conversations_contextual_limited;

ALTER TABLE conversations 
    ADD COLUMN IF NOT EXISTS contextual_limited BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE conversations 
    ADD CONSTRAINT chk_conversations_contextual_limited 
    CHECK (contextual_limited = FALSE OR type = 'DIRECT');