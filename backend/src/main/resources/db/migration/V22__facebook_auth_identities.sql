ALTER TABLE user_auth_identities DROP CONSTRAINT user_auth_identities_provider_check;
ALTER TABLE user_auth_identities ADD CONSTRAINT user_auth_identities_provider_check
    CHECK (provider IN ('GOOGLE', 'FACEBOOK'));
ALTER TABLE user_auth_identities ALTER COLUMN provider_email DROP NOT NULL;
