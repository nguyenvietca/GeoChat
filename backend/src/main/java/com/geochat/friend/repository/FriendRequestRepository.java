package com.geochat.friend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.geochat.friend.entity.FriendRequest;
import com.geochat.friend.entity.FriendRequestStatus;

import jakarta.persistence.LockModeType;

@Repository
public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {
	boolean existsBySenderIdAndReceiverIdAndStatus(Long senderId, Long receiverId, FriendRequestStatus status);

	boolean existsByReceiverIdAndSenderIdAndStatus(Long receiverId, Long senderId, FriendRequestStatus status);

	long deleteBySenderIdAndReceiverIdAndStatus(Long senderId, Long receiverId, FriendRequestStatus status);

	default boolean areFriends(Long firstUserId, Long secondUserId) {
		return existsBySenderIdAndReceiverIdAndStatus(firstUserId, secondUserId, FriendRequestStatus.ACCEPTED)
				|| existsBySenderIdAndReceiverIdAndStatus(secondUserId, firstUserId, FriendRequestStatus.ACCEPTED);
	}

	List<FriendRequest> findByReceiverIdAndStatusOrderByCreatedAtDesc(Long receiverId, FriendRequestStatus status);

	List<FriendRequest> findBySenderIdAndStatusOrderByCreatedAtDesc(Long senderId, FriendRequestStatus status);

	Optional<FriendRequest> findById(Long id);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select request from FriendRequest request where request.id = :id")
	Optional<FriendRequest> findByIdForUpdate(@Param("id") Long id);

	@Query("""
			select request from FriendRequest request
			where request.status in :statuses
			  and ((request.senderId = :userId and request.receiverId in :otherIds)
			    or (request.receiverId = :userId and request.senderId in :otherIds))
			""")
	List<FriendRequest> findRelationships(@Param("userId") Long userId, @Param("otherIds") List<Long> otherIds,
			@Param("statuses") List<FriendRequestStatus> statuses);
}
