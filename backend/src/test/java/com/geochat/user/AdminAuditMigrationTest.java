package com.geochat.user;

import java.sql.DriverManager;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AdminAuditMigrationTest {
    @Test void extendsExistingAuditWithoutChangingRows() throws Exception {
        try(var db=DriverManager.getConnection("jdbc:h2:mem:admin_audit_migration;MODE=PostgreSQL;DATABASE_TO_UPPER=false" );var sql=db.createStatement()) {
            sql.execute("CREATE TABLE users(id BIGINT PRIMARY KEY,status VARCHAR(32),created_at TIMESTAMP WITH TIME ZONE,updated_at TIMESTAMP WITH TIME ZONE)");
            try(var input=getClass().getResourceAsStream("/db/migration/V20__account_lifecycle.sql")){sql.execute(new String(input.readAllBytes(),StandardCharsets.UTF_8));}
            sql.execute("INSERT INTO account_actions(actor_id,user_id,action,reason,created_at) VALUES(1,2,'BLOCK','Existing reason',CURRENT_TIMESTAMP)");
            try(var input=getClass().getResourceAsStream("/db/migration/V23__admin_audit_details.sql")){sql.execute(new String(input.readAllBytes(),StandardCharsets.UTF_8));}
            try(var rows=sql.executeQuery("SELECT previous_status,reason FROM account_actions")){assertThat(rows.next()).isTrue();assertThat(rows.getString(1)).isNull();assertThat(rows.getString(2)).isEqualTo("Existing reason");}
        }
    }
    @Test
    @org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named="GEOCHAT_VALIDATE_POSTGRES",matches="true")
    void postgresMigrationPreservesAudit() throws Exception {
        var env=System.getenv();
        String url="jdbc:postgresql://"+env.getOrDefault("DB_HOST","localhost")+":"+env.getOrDefault("DB_PORT","5432")+"/"+env.getOrDefault("DB_NAME","geochat");
        try(var db=DriverManager.getConnection(url,env.getOrDefault("DB_USERNAME","geochat"),env.getOrDefault("DB_PASSWORD",""))) {
            db.setAutoCommit(false);
            try(var sql=db.createStatement()) {
                String schema="admin046_"+Long.toUnsignedString(System.nanoTime());
                sql.execute("CREATE SCHEMA "+schema);sql.execute("SET LOCAL search_path TO "+schema);
                sql.execute("CREATE TABLE users(id BIGINT PRIMARY KEY,status VARCHAR(32),created_at TIMESTAMP WITH TIME ZONE,updated_at TIMESTAMP WITH TIME ZONE)");
                try(var input=getClass().getResourceAsStream("/db/migration/V20__account_lifecycle.sql")){sql.execute(new String(input.readAllBytes(),StandardCharsets.UTF_8));}
                sql.execute("INSERT INTO account_actions(actor_id,user_id,action,reason,created_at) VALUES(1,2,'BLOCK','Existing reason',CURRENT_TIMESTAMP)");
                try(var input=getClass().getResourceAsStream("/db/migration/V23__admin_audit_details.sql")){sql.execute(new String(input.readAllBytes(),StandardCharsets.UTF_8));}
                try(var rows=sql.executeQuery("SELECT reason,previous_status FROM account_actions")){assertThat(rows.next()).isTrue();assertThat(rows.getString(1)).isEqualTo("Existing reason");assertThat(rows.getString(2)).isNull();}
            }finally {db.rollback();}
        }
    }
}
