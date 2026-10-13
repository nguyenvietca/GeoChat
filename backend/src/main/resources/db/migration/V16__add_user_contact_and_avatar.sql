ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(320);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_storage_key VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_content_type VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_ci
    ON users (LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_avatar_storage_key
    ON users (avatar_storage_key) WHERE avatar_storage_key IS NOT NULL;
