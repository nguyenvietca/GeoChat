ALTER TABLE users ADD COLUMN password_login_enabled BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE user_auth_identities (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(16) NOT NULL CHECK (provider = 'GOOGLE'),
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(320) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_auth_provider_subject UNIQUE(provider, provider_user_id),
    CONSTRAINT uq_auth_user_provider UNIQUE(user_id, provider)
);
