CREATE TABLE message_attachments (
 id BIGSERIAL PRIMARY KEY,
 message_id BIGINT NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
 conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 uploader_id BIGINT NOT NULL REFERENCES users(id),
 request_id VARCHAR(36) NOT NULL UNIQUE,
 storage_key VARCHAR(64) NOT NULL UNIQUE,
 original_filename VARCHAR(160) NOT NULL,
 content_type VARCHAR(32) NOT NULL CHECK (content_type IN ('image/jpeg','image/png')),
 size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
 width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 4096),
 height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 4096),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_message_attachments_conversation ON message_attachments(conversation_id);
