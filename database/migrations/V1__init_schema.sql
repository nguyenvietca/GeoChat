CREATE TABLE IF NOT EXISTS app_metadata (
    key_name VARCHAR(255) PRIMARY KEY,
    value_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_metadata (key_name, value_text)
VALUES ('database_foundation', 'ready')
ON CONFLICT (key_name) DO NOTHING;
