package com.geochat.chat;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.sql.*;
import java.nio.charset.StandardCharsets;
import static org.assertj.core.api.Assertions.*;
@EnabledIfEnvironmentVariable(named="GEOCHAT_VALIDATE_POSTGRES",matches="true")
class PostgresImageMigrationTest {
 @Test void attachmentMigrationCascadesAndPreservesExistingMessages() throws Exception {
  String url="jdbc:postgresql://"+env("DB_HOST","localhost")+":"+env("DB_PORT","5432")+"/"+env("DB_NAME","geochat");
  try(var db=DriverManager.getConnection(url,env("DB_USERNAME","geochat"),env("DB_PASSWORD",""))) {
   db.setAutoCommit(false);
   try(var sql=db.createStatement()){
    String schema="photo_validation_"+Long.toUnsignedString(System.nanoTime());
    sql.execute("CREATE SCHEMA "+schema);
    sql.execute("SET LOCAL search_path TO "+schema);
    sql.execute("CREATE TABLE users(id BIGINT PRIMARY KEY); CREATE TABLE conversations(id BIGINT PRIMARY KEY); CREATE TABLE messages(id BIGINT PRIMARY KEY, content TEXT NOT NULL)");
    sql.execute("INSERT INTO users VALUES(1); INSERT INTO conversations VALUES(1); INSERT INTO messages VALUES(1,'legacy')");
    try(var resource=getClass().getResourceAsStream("/db/migration/V14__add_message_images.sql")){sql.execute(new String(resource.readAllBytes(),StandardCharsets.UTF_8));}
    sql.execute("INSERT INTO message_attachments(message_id,conversation_id,uploader_id,request_id,storage_key,original_filename,content_type,size_bytes,width,height) VALUES(1,1,1,'request','generated.png','photo.png','image/png',100,12,8)");
    try(var row=sql.executeQuery("SELECT content FROM messages WHERE id=1")){assertThat(row.next()).isTrue();assertThat(row.getString(1)).isEqualTo("legacy");}
    sql.execute("DELETE FROM messages WHERE id=1");
    try(var row=sql.executeQuery("SELECT count(*) FROM message_attachments")){row.next();assertThat(row.getLong(1)).isZero();}
   }finally{db.rollback();}
  }
 }
 private static String env(String name,String fallback){return System.getenv().getOrDefault(name,fallback);}
}
