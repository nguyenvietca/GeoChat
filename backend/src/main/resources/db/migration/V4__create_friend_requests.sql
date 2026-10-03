CREATE TABLE IF NOT EXISTS friend_requests (
    id BIGSERIAL PRIMARY KEY,
    sender_id BIGINT NOT NULL,
    receiver_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_friend_requests_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT chk_friend_requests_not_self CHECK (sender_id <> receiver_id),
    CONSTRAINT fk_friend_requests_sender FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_friend_requests_receiver FOREIGN KEY (receiver_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_friend_requests_pair_status UNIQUE (sender_id, receiver_id, status)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_sender_status ON friend_requests (sender_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_status ON friend_requests (receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests (status);
