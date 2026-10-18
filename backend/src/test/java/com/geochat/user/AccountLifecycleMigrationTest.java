package com.geochat.user;

import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AccountLifecycleMigrationTest {
    @Test void migrationPreservesExistingStatesAndBackfillsOnlySelfDeactivatedUsers() throws Exception {
        try (var db = DriverManager.getConnection("jdbc:h2:mem:lifecycle_migration;MODE=PostgreSQL;DATABASE_TO_UPPER=false")) {
            try (var sql = db.createStatement()) {
                sql.execute("CREATE TABLE users(id BIGINT PRIMARY KEY, status VARCHAR(32) NOT NULL, updated_at TIMESTAMP WITH TIME ZONE NOT NULL)");
                sql.execute("INSERT INTO users VALUES (1,'ACTIVE',CURRENT_TIMESTAMP),(2,'INACTIVE',CURRENT_TIMESTAMP),(3,'LOCKED',CURRENT_TIMESTAMP)");
                try (var resource = getClass().getResourceAsStream("/db/migration/V20__account_lifecycle.sql")) {
                    sql.execute(new String(resource.readAllBytes(), StandardCharsets.UTF_8));
                }
                try (var rows = sql.executeQuery("SELECT * FROM users ORDER BY id")) {
                    rows.next(); assertThat(rows.getString("status")).isEqualTo("ACTIVE");
                    assertThat(rows.getString("role")).isEqualTo("USER"); assertThat(rows.getLong("auth_version")).isZero();
                    assertThat(rows.getLong("row_version")).isZero();
                    assertThat(rows.getObject("self_deactivated_at")).isNull();
                    rows.next(); assertThat(rows.getString("status")).isEqualTo("INACTIVE");
                    assertThat(rows.getObject("self_deactivated_at")).isNotNull();
                    rows.next(); assertThat(rows.getString("status")).isEqualTo("LOCKED");
                    assertThat(rows.getObject("self_deactivated_at")).isNull();
                }
                sql.execute("INSERT INTO account_actions(actor_id,user_id,action,reason,created_at) VALUES (1,2,'BLOCK','Spam',CURRENT_TIMESTAMP)");
                assertThatThrownBy(() -> sql.execute("UPDATE users SET role='OWNER' WHERE id=1")).isInstanceOf(java.sql.SQLException.class);
            }
        }
    }
}
