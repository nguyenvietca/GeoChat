CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS user_locations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location geography(Point, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    ) STORED NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_locations_latitude_range_check CHECK (latitude >= -90 AND latitude <= 90),
    CONSTRAINT user_locations_longitude_range_check CHECK (longitude >= -180 AND longitude <= 180)
);

ALTER TABLE user_locations ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE user_locations ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

UPDATE user_locations
SET latitude = ST_Y(location::geometry),
    longitude = ST_X(location::geometry)
WHERE latitude IS NULL OR longitude IS NULL;

ALTER TABLE user_locations ALTER COLUMN latitude SET NOT NULL;
ALTER TABLE user_locations ALTER COLUMN longitude SET NOT NULL;
ALTER TABLE user_locations ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'user_locations'::regclass
          AND conname = 'user_locations_latitude_range_check'
    ) THEN
        ALTER TABLE user_locations
            ADD CONSTRAINT user_locations_latitude_range_check CHECK (latitude >= -90 AND latitude <= 90);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'user_locations'::regclass
          AND conname = 'user_locations_longitude_range_check'
    ) THEN
        ALTER TABLE user_locations
            ADD CONSTRAINT user_locations_longitude_range_check CHECK (longitude >= -180 AND longitude <= 180);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'user_locations'::regclass
          AND contype = 'f'
          AND conname = 'user_locations_user_id_fkey'
    ) THEN
        ALTER TABLE user_locations
            ADD CONSTRAINT user_locations_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
DECLARE
    location_generated text;
BEGIN
    SELECT is_generated INTO location_generated
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'user_locations'
      AND column_name = 'location';

    IF location_generated <> 'ALWAYS' THEN
        ALTER TABLE user_locations DROP COLUMN location;
        ALTER TABLE user_locations
            ADD COLUMN location geography(Point, 4326) GENERATED ALWAYS AS (
                ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
            ) STORED NOT NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_locations_geography ON user_locations USING GIST (location);