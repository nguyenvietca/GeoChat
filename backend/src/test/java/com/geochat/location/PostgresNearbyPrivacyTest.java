package com.geochat.location;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.sql.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
import static org.assertj.core.api.Assertions.*;
@EnabledIfEnvironmentVariable(named="GEOCHAT_VALIDATE_POSTGRES",matches="true")
class PostgresNearbyPrivacyTest {
 @Test void realPostgisUsesStableAreasOptInFreshnessAndMeterRadii() throws Exception {
  String url="jdbc:postgresql://"+env("DB_HOST","localhost")+":"+env("DB_PORT","5432")+"/"+env("DB_NAME","geochat");
  try(var db=DriverManager.getConnection(url,env("DB_USERNAME","geochat"),env("DB_PASSWORD",""))){
   db.setAutoCommit(false);
   try(var sql=db.createStatement()){
    String schema="nearby_validation_"+Long.toUnsignedString(System.nanoTime());sql.execute("CREATE SCHEMA "+schema);sql.execute("SET LOCAL search_path TO "+schema+", public");
    sql.execute("CREATE TABLE users(id BIGINT PRIMARY KEY,display_name TEXT,status TEXT); CREATE TABLE user_locations(user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,latitude DOUBLE PRECISION,longitude DOUBLE PRECISION,updated_at TIMESTAMPTZ)");
    sql.execute("INSERT INTO users VALUES(1,'Viewer','ACTIVE'),(2,'Target','ACTIVE'); INSERT INTO user_locations VALUES(1,0.01,0.01,NOW()),(2,0.02,0.02,NOW())");
    try(var resource=getClass().getResourceAsStream("/db/migration/V15__nearby_privacy.sql")){sql.execute(new String(resource.readAllBytes(),StandardCharsets.UTF_8));}
    assertThat(nearby(db,1000)).isEmpty();sql.execute("UPDATE users SET nearby_discoverable=true WHERE id=2");
    var original=nearby(db,1000);assertThat(original).hasSize(1);assertThat(original.getFirst().get(0)).isEqualTo(2L);
    sql.execute("UPDATE user_locations SET latitude=0.049,longitude=0.041 WHERE user_id=2");assertThat(nearby(db,1000)).isEqualTo(original);
    sql.execute("UPDATE user_locations SET latitude=0.06,longitude=0.01 WHERE user_id=2");assertThat(nearby(db,1000)).isEmpty();assertThat(nearby(db,10000)).hasSize(1);
    sql.execute("UPDATE user_locations SET updated_at=NOW()-INTERVAL '25 hours' WHERE user_id=2");assertThat(nearby(db,10000)).isEmpty();
    sql.execute("UPDATE user_locations SET updated_at=NOW() WHERE user_id=2; UPDATE users SET nearby_discoverable=false WHERE id=2");assertThat(nearby(db,10000)).isEmpty();
    try(var row=sql.executeQuery("SELECT indexdef FROM pg_indexes WHERE schemaname='"+schema+"' AND indexname='idx_user_locations_discovery_area'")){assertThat(row.next()).isTrue();assertThat(row.getString(1)).contains("gist");}
   }finally{db.rollback();}
  }
 }
 private List<List<Object>> nearby(Connection db,int radius)throws Exception {
  String query=com.geochat.location.repository.UserLocationSearchRepositoryImpl.postgresNearbySql()+" ORDER BY 3,1 LIMIT :limit OFFSET :offset";
  var values=Map.<String,Object>of("id",1L,"lat",0.025,"lng",0.025,"fresh",Timestamp.from(java.time.Instant.now().minusSeconds(86400)),"radius",radius,"limit",20,"offset",0);
  var matcher=java.util.regex.Pattern.compile("(?<!:):([A-Za-z]+)").matcher(query);var names=new ArrayList<String>();var text=new StringBuffer();
  while(matcher.find()){names.add(matcher.group(1));matcher.appendReplacement(text,"?");}matcher.appendTail(text);
  try(var statement=db.prepareStatement(text.toString())){for(int i=0;i<names.size();i++)statement.setObject(i+1,values.get(names.get(i)));
   try(var rows=statement.executeQuery()){var result=new ArrayList<List<Object>>();while(rows.next())result.add(List.of(rows.getLong(1),rows.getString(2),rows.getDouble(3),rows.getDouble(4),rows.getDouble(5)));return result;}
  }
 }
 private static String env(String name,String fallback){return System.getenv().getOrDefault(name,fallback);}
}
