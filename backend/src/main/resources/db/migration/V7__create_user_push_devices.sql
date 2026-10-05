CREATE TABLE IF NOT EXISTS user_push_devices (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    push_token VARCHAR(512) NOT NULL UNIQUE,
    platform VARCHAR(16) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_user_push_devices_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_push_devices_user_active
    ON user_push_devices (user_id, active);