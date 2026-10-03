package com.geochat.friend.repository;

import com.geochat.friend.entity.FriendRequest;
import com.geochat.friend.entity.FriendRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {
    boolean existsBySenderIdAndReceiverIdAndStatus(Long senderId, Long receiverId, FriendRequestStatus status);
    boolean existsByReceiverIdAndSenderIdAndStatus(Long receiverId, Long senderId, FriendRequestStatus status);
    List<FriendRequest> findByReceiverIdAndStatusOrderByCreatedAtDesc(Long receiverId, FriendRequestStatus status);
    List<FriendRequest> findBySenderIdAndStatusOrderByCreatedAtDesc(Long senderId, FriendRequestStatus status);
    Optional<FriendRequest> findById(Long id);
}
