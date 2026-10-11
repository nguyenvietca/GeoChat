ALTER TABLE users ADD COLUMN nearby_discoverable BOOLEAN NOT NULL DEFAULT FALSE;
-- Fixed 0.05-degree cells: all discovery geometry is derived from these centers.
ALTER TABLE user_locations ADD COLUMN discovery_area geography(Point,4326) GENERATED ALWAYS AS (
 ST_SetSRID(ST_MakePoint(LEAST(179.975,FLOOR(longitude / 0.05)*0.05+0.025),LEAST(89.975,FLOOR(latitude / 0.05)*0.05+0.025)),4326)::geography
) STORED;
CREATE INDEX idx_user_locations_discovery_area ON user_locations USING GIST(discovery_area);
