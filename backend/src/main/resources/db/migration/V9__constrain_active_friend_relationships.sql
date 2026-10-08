ALTER TABLE friend_requests
    DROP CONSTRAINT IF EXISTS uq_friend_requests_pair_status;

CREATE UNIQUE INDEX IF NOT EXISTS uq_friend_requests_active_pair
    ON friend_requests (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id))
    WHERE status IN ('PENDING', 'ACCEPTED');