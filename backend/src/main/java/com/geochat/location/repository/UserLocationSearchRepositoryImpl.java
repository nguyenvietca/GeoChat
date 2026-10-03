package com.geochat.location.repository;

import java.sql.Connection;
import java.util.ArrayList;
import java.util.List;

import javax.sql.DataSource;

import org.springframework.stereotype.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.persistence.PersistenceContext;

@Repository
public class UserLocationSearchRepositoryImpl implements UserLocationSearchRepository {

	private final DataSource dataSource;

	@PersistenceContext
	private EntityManager entityManager;

	public UserLocationSearchRepositoryImpl(DataSource dataSource) {
		this.dataSource = dataSource;
	}

	@Override
	public List<NearbyUserRow> findNearbyUsers(Long currentUserId, Double currentLatitude, Double currentLongitude,
			Double radiusMeters, Integer limit) {
		boolean isPostgreSql = databaseProductName().equalsIgnoreCase("PostgreSQL");
		String sql = isPostgreSql ? postgresNearbyQuery() : h2NearbyQuery();

		Query query = entityManager.createNativeQuery(sql)
				.setParameter("currentUserId", currentUserId)
				.setParameter("radiusMeters", radiusMeters)
				.setParameter("limit", limit);
		if (!isPostgreSql) {
			query.setParameter("currentLatitude", currentLatitude)
					.setParameter("currentLongitude", currentLongitude);
		}

		List<Object[]> rows = query.getResultList();

		List<NearbyUserRow> results = new ArrayList<>();
		for (Object[] row : rows) {
			results.add(new NearbyUserRow(((Number) row[0]).longValue(), String.valueOf(row[1]),
					((Number) row[2]).doubleValue()));
		}
		return results;
	}

	private String databaseProductName() {
		try (Connection connection = dataSource.getConnection()) {
			return connection.getMetaData().getDatabaseProductName();
		} catch (Exception ex) {
			return "H2";
		}
	}

	private String postgresNearbyQuery() {
		return """
				SELECT u.id AS userId,
				       u.display_name AS displayName,
				       ST_Distance(current.location, target.location) AS distanceMeters
				FROM user_locations target
				JOIN users u ON u.id = target.user_id
				JOIN user_locations current ON current.user_id = :currentUserId
				WHERE target.user_id <> :currentUserId
				  AND current.user_id = :currentUserId
				  AND ST_DWithin(current.location, target.location, :radiusMeters)
				ORDER BY distanceMeters ASC
				LIMIT :limit
				""";
	}

	private String h2NearbyQuery() {
		return """
				SELECT u.id AS userId,
				       u.display_name AS displayName,
				       (6371000 * ACOS(
				           LEAST(1,
				               COS(RADIANS(:currentLatitude)) * COS(RADIANS(ul.latitude))
				               * COS(RADIANS(ul.longitude) - RADIANS(:currentLongitude))
				               + SIN(RADIANS(:currentLatitude)) * SIN(RADIANS(ul.latitude))
				           )
				       )) AS distanceMeters
				FROM user_locations ul
				JOIN users u ON u.id = ul.user_id
				WHERE ul.user_id <> :currentUserId
				  AND (6371000 * ACOS(
				          LEAST(1,
				              COS(RADIANS(:currentLatitude)) * COS(RADIANS(ul.latitude))
				              * COS(RADIANS(ul.longitude) - RADIANS(:currentLongitude))
				              + SIN(RADIANS(:currentLatitude)) * SIN(RADIANS(ul.latitude))
				          )
				      )) <= :radiusMeters
				ORDER BY distanceMeters ASC
				LIMIT :limit
				""";
	}
}
