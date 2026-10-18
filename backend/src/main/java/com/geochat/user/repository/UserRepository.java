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
