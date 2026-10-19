package com.geochat.auth.google;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

@EnabledIfEnvironmentVariable(named = "GEOCHAT_VALIDATE_POSTGRES", matches = "true")
class PostgresGoogleIdentityMigrationTest {
	@Test
	void preservesPasswordsAndEnforcesIdentityConstraintsWithCascade() throws Exception {
		String url = "jdbc:postgresql://" + env("DB_HOST", "localhost") + ":" + env("DB_PORT", "5432") + "/"
				+ env("DB_NAME", "geochat");
		try (var db = DriverManager.getConnection(url, env("DB_USERNAME", "geochat"), env("DB_PASSWORD", ""))) {
			db.setAutoCommit(false);
			try (var sql = db.createStatement()) {
				String schema = "google_validation_" + Long.toUnsignedString(System.nanoTime());
				sql.execute("CREATE SCHEMA " + schema);
				sql.execute("SET LOCAL search_path TO " + schema);
				sql.execute(
						"CREATE TABLE users(id BIGINT PRIMARY KEY,password_hash TEXT NOT NULL); INSERT INTO users VALUES(1,'preserved-hash'),(2,'second-hash')");
				try (var resource = getClass().getResourceAsStream("/db/migration/V19__google_auth_identities.sql")) {
					sql.execute(new String(resource.readAllBytes(), StandardCharsets.UTF_8));
				}
				try (var row = sql.executeQuery("SELECT password_hash,password_login_enabled FROM users WHERE id=1")) {
					assertThat(row.next()).isTrue();
					assertThat(row.getString(1)).isEqualTo("preserved-hash");
					assertThat(row.getBoolean(2)).isTrue();
				}
				sql.execute(
						"INSERT INTO user_auth_identities(user_id,provider,provider_user_id,provider_email) VALUES(1,'GOOGLE','subject','test@example.com')");
				try (var resource = getClass().getResourceAsStream("/db/migration/V22__facebook_auth_identities.sql")) {
					sql.execute(new String(resource.readAllBytes(), StandardCharsets.UTF_8));
				}
				sql.execute("INSERT INTO user_auth_identities(user_id,provider,provider_user_id,provider_email) VALUES(1,'FACEBOOK','app-scoped-id',NULL)");
				reject(db, "INSERT INTO user_auth_identities(user_id,provider,provider_user_id,provider_email) VALUES(2,'FACEBOOK','app-scoped-id',NULL)");
				reject(db, "INSERT INTO user_auth_identities(user_id,provider,provider_user_id,provider_email) VALUES(1,'FACEBOOK','other-id',NULL)");
				reject(db, "INSERT INTO user_auth_identities(user_id,provider,provider_user_id,provider_email) VALUES(2,'UNKNOWN','subject',NULL)");
				try (var row = sql.executeQuery("SELECT count(*) FROM user_auth_identities WHERE user_id=1")) {
					row.next(); assertThat(row.getLong(1)).isEqualTo(2);
				}
				reject(db,
						"INSERT INTO user_auth_identities(user_id,provider,provider_user_id,provider_email) VALUES(2,'GOOGLE','subject','test@example.com')");
				reject(db,
						"INSERT INTO user_auth_identities(user_id,provider,provider_user_id,provider_email) VALUES(1,'GOOGLE','other','test@example.com')");
				reject(db,
						"INSERT INTO user_auth_identities(user_id,provider,provider_user_id,provider_email) VALUES(999,'GOOGLE','other','test@example.com')");
				sql.execute("DELETE FROM user_auth_identities WHERE user_id=1");
				try (var row = sql.executeQuery("SELECT count(*) FROM users")) {
					row.next();
					assertThat(row.getLong(1)).isEqualTo(2);
				}
				sql.execute(
						"INSERT INTO user_auth_identities(user_id,provider,provider_user_id,provider_email) VALUES(1,'GOOGLE','subject','test@example.com'); DELETE FROM users WHERE id=1");
				try (var row = sql.executeQuery("SELECT count(*) FROM user_auth_identities")) {
					row.next();
					assertThat(row.getLong(1)).isZero();
				}
			} finally {
				db.rollback();
			}
		}
	}

	void reject(Connection db, String statement) throws Exception {
		var point = db.setSavepoint();
		try (var sql = db.createStatement()) {
			assertThatThrownBy(() -> sql.execute(statement)).isInstanceOf(SQLException.class);
		} finally {
			db.rollback(point);
			db.releaseSavepoint(point);
		}
	}

	static String env(String key, String fallback) {
		return System.getenv().getOrDefault(key, fallback);
	}
}
