package com.geochat.chat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import static org.assertj.core.api.Assertions.*;

/** Optional real PostgreSQL validation; all DDL/data stay in an isolated, rolled-back transaction. */
@EnabledIfEnvironmentVariable(named = "GEOCHAT_VALIDATE_POSTGRES", matches = "true")
class PostgresMessageActionsMigrationTest {
    @Test void migrationPreservesRowsEnforcesConstraintsAndCleansUpGroupMessages() throws Exception {
        String url = "jdbc:postgresql://" + env("DB_HOST", "localhost") + ":" + env("DB_PORT", "5432") + "/" + env("DB_NAME", "geochat");
        try (Connection connection = DriverManager.getConnection(url, env("DB_USERNAME", "geochat"), env("DB_PASSWORD", ""))) {
            connection.setAutoCommit(false);
            try (Statement sql = connection.createStatement()) {
                String schema = "prompt034_validation_" + Long.toUnsignedString(System.nanoTime());
                sql.execute("CREATE SCHEMA " + schema);
                sql.execute("SET LOCAL search_path TO " + schema);
                sql.execute("CREATE TABLE users(id BIGINT PRIMARY KEY)");
                sql.execute("CREATE TABLE conversations(id BIGINT PRIMARY KEY)");
                sql.execute("CREATE TABLE messages(id BIGSERIAL PRIMARY KEY, conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, sender_id BIGINT NOT NULL REFERENCES users(id), content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
                sql.execute("INSERT INTO users VALUES (1), (2); INSERT INTO conversations VALUES (1); INSERT INTO messages(id, conversation_id, sender_id, content) VALUES (10,1,1,'legacy')");
                try (var resource = getClass().getResourceAsStream("/db/migration/V13__add_message_replies_and_reactions.sql")) {
                    assertThat(resource).isNotNull();
                    sql.execute(new String(resource.readAllBytes(), StandardCharsets.UTF_8));
                }
                try (var rows = sql.executeQuery("SELECT id, content, reply_to_message_id, reaction_version FROM messages")) {
                    assertThat(rows.next()).isTrue(); assertThat(rows.getLong(1)).isEqualTo(10);
                    assertThat(rows.getString(2)).isEqualTo("legacy"); assertThat(rows.getObject(3)).isNull();
                    assertThat(rows.getLong(4)).isZero();
                }
                sql.execute("INSERT INTO messages(id, conversation_id, sender_id, content, reply_to_message_id) VALUES (20,1,2,'reply',10)");
                sql.execute("INSERT INTO message_reactions(message_id, user_id, emoji) VALUES (10,1,'👍'),(20,2,'❤️')");
                assertSqlRejected(connection, "INSERT INTO message_reactions(message_id, user_id, emoji) VALUES (10,1,'👍')");
                assertSqlRejected(connection, "INSERT INTO message_reactions(message_id, user_id, emoji) VALUES (10,1,'unsupported')");
                assertSqlRejected(connection, "INSERT INTO message_reactions(message_id, user_id, emoji) VALUES (999,1,'👍')");
                assertSqlRejected(connection, "UPDATE messages SET reply_to_message_id = 999 WHERE id = 20");
                sql.execute("DELETE FROM messages WHERE id=10");
                try (var row = sql.executeQuery("SELECT reply_to_message_id FROM messages WHERE id=20")) {
                    assertThat(row.next()).isTrue(); assertThat(row.getObject(1)).isNull();
                }
                sql.execute("INSERT INTO messages(id, conversation_id, sender_id, content, reply_to_message_id) VALUES (30,1,1,'nested',20)");
                sql.execute("DELETE FROM messages WHERE conversation_id=1; DELETE FROM conversations WHERE id=1");
                try (var row = sql.executeQuery("SELECT count(*) FROM message_reactions")) {
                    assertThat(row.next()).isTrue(); assertThat(row.getLong(1)).isZero();
                }
            } finally { connection.rollback(); }
        }
    }

    private void assertSqlRejected(Connection connection, String statement) throws Exception {
        Savepoint point = connection.setSavepoint();
        try (Statement sql = connection.createStatement()) {
            assertThatThrownBy(() -> sql.execute(statement)).isInstanceOf(SQLException.class);
        } finally { connection.rollback(point); connection.releaseSavepoint(point); }
    }
    private static String env(String name, String fallback) { return System.getenv().getOrDefault(name, fallback); }
}
