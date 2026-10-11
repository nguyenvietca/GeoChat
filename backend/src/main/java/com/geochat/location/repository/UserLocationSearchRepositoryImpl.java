package com.geochat.location.repository;

import jakarta.persistence.*;
import org.springframework.stereotype.Repository;
import javax.sql.DataSource;
import java.util.*;
import java.time.Instant;

@Repository
public class UserLocationSearchRepositoryImpl implements UserLocationSearchRepository {
  private final DataSource dataSource;
  @PersistenceContext
  private EntityManager entityManager;

  public UserLocationSearchRepositoryImpl(DataSource dataSource) {
    this.dataSource = dataSource;
  }

  public static double cellLatitude(double value) {
    return Math.min(89.975, Math.floor(value / 0.05) * 0.05 + 0.025);
  }

  public static double cellLongitude(double value) {
    return Math.min(179.975, Math.floor(value / 0.05) * 0.05 + 0.025);
  }

  private boolean postgres() {
    try (var db = dataSource.getConnection()) {
      return db.getMetaData().getDatabaseProductName().equalsIgnoreCase("PostgreSQL");
    } catch (Exception ex) {
      throw new IllegalStateException("Location database unavailable");
    }
  }

  @Override
  public List<NearbyUserRow> findNearbyUsers(Long id, Double lat, Double lng, Double radius, Integer limit,
      Integer offset) {
    var query = query(id, lat, lng, radius, null).setParameter("limit", limit).setParameter("offset", offset);
    List<Object[]> rows = query.getResultList();
    return rows.stream()
        .map(row -> new NearbyUserRow(((Number) row[0]).longValue(), String.valueOf(row[1]),
            ((Number) row[2]).doubleValue(), ((Number) row[3]).doubleValue(), ((Number) row[4]).doubleValue()))
        .toList();
  }

  @Override
  public boolean isWithinRadius(Long id, Long target, Double lat, Double lng, Double radius) {
    return !query(id, lat, lng, radius, target).setParameter("limit", 1).setParameter("offset", 0).getResultList()
        .isEmpty();
  }

  private Query query(Long id, double lat, double lng, double radius, Long target) {
    String sql;
    if (postgres()) {
      sql = postgresNearbySql();
    } else {
      sql = """
 SELECT id,display_name,distance,area_lat,area_lng FROM (
  SELECT id,display_name,area_lat,area_lng,6371000*ACOS(LEAST(1.0,GREATEST(-1.0,
   COS(RADIANS(:lat))*COS(RADIANS(area_lat))*COS(RADIANS(area_lng)-RADIANS(:lng))+
   SIN(RADIANS(:lat))*SIN(RADIANS(area_lat))))) AS distance
  FROM (SELECT u.id,u.display_name,LEAST(89.975,FLOOR(t.latitude/0.05)*0.05+0.025) AS area_lat,
   LEAST(179.975,FLOOR(t.longitude/0.05)*0.05+0.025) AS area_lng
   FROM user_locations t JOIN users u ON u.id=t.user_id
   WHERE u.id<>:id AND u.status='ACTIVE' AND u.nearby_discoverable=TRUE AND t.updated_at>=:fresh
  ) coarse
 ) areas WHERE distance<=:radius
 """;
    }
    if (target != null)
      sql += " AND " + (sql.contains("areas WHERE") ? "id" : "u.id") + "=:target";
    sql += " ORDER BY 3,1 LIMIT :limit OFFSET :offset";
    var query = entityManager.createNativeQuery(sql).setParameter("id", id).setParameter("lat", cellLatitude(lat))
        .setParameter("lng", cellLongitude(lng)).setParameter("radius", radius)
        .setParameter("fresh", Instant.now().minusSeconds(86400));
    if (target != null)
      query.setParameter("target", target);
    return query;
  }
 public static String postgresNearbySql(){return """
          SELECT u.id,u.display_name,ST_Distance(t.discovery_area,ST_SetSRID(ST_MakePoint(:lng,:lat),4326)::geography),
           ST_Y(t.discovery_area::geometry),ST_X(t.discovery_area::geometry)
          FROM user_locations t JOIN users u ON u.id=t.user_id
          WHERE u.id<>:id AND u.status='ACTIVE' AND u.nearby_discoverable=TRUE AND t.updated_at>=:fresh
           AND ST_DWithin(t.discovery_area,ST_SetSRID(ST_MakePoint(:lng,:lat),4326)::geography,:radius)
          """;}
}
