package com.geochat.user.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.geochat.user.entity.User;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    long countByCreatedAtGreaterThanEqual(java.time.Instant since);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.role in (com.geochat.user.entity.UserRole.ADMIN, com.geochat.user.entity.UserRole.SUPER_ADMIN) order by u.id")
    java.util.List<User> lockAdministrators();
    @Query("select count(u) from User u where u.status=com.geochat.user.entity.UserStatus.ACTIVE and u.role in (com.geochat.user.entity.UserRole.ADMIN,com.geochat.user.entity.UserRole.SUPER_ADMIN)")
    long countActiveAdministrators();
    boolean existsByRoleAndPasswordLoginEnabledTrue(com.geochat.user.entity.UserRole role);
    long countByStatus(com.geochat.user.entity.UserStatus status);
    java.util.Optional<User> findByEmailIgnoreCase(String email);
    long countByStatusAndIdIn(com.geochat.user.entity.UserStatus status, java.util.Collection<Long> ids);
	@Query("select u from User u where lower(u.username) like lower(concat('%', :query, '%')) or lower(u.displayName) like lower(concat('%', :query, '%')) order by u.id desc")
	Page<User> adminSearch(@Param("query") String query, Pageable pageable);

	boolean existsByEmailIgnoreCase(String email);

	boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);

	@org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
	@Query("select u from User u where u.id = :id")
	Optional<User> lockById(@Param("id") Long id);

	boolean existsByAvatarStorageKey(String avatarStorageKey);

	boolean existsByUsernameIgnoreCase(String username);

	Optional<User> findByUsernameIgnoreCase(String username);

	@Query("""
			select u from User u
			where u.id <> :currentUserId
			  and (
			      lower(u.username) like lower(concat('%', :query, '%'))
			      or lower(u.displayName) like lower(concat('%', :query, '%'))
			  )
			  and u.status = com.geochat.user.entity.UserStatus.ACTIVE
			order by lower(u.username) asc, u.id asc
			""")
	Page<User> searchUsers(@Param("currentUserId") Long currentUserId, @Param("query") String query, Pageable pageable);
}
