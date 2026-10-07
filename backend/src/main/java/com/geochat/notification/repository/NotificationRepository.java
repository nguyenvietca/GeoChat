package com.geochat.notification.repository;

import com.geochat.notification.entity.Notification;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByRecipientIdOrderByCreatedAtDesc(Long recipientId);

    @Query(value = "SELECT * FROM notifications WHERE recipient_id = :recipientId "
        + "ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset", nativeQuery = true)
    List<Notification> findPageByRecipientId(
        @Param("recipientId") Long recipientId,
        @Param("limit") int limit,
        @Param("offset") int offset);

    long countByRecipientIdAndReadFalse(Long recipientId);

    long countByRecipientId(Long recipientId);

        @Modifying(clearAutomatically = true)
        @Query("UPDATE Notification n SET n.read = true, n.readAt = :readAt "
            + "WHERE n.recipientId = :recipientId AND n.read = false")
        int markAllAsRead(@Param("recipientId") Long recipientId, @Param("readAt") java.time.Instant readAt);

    Optional<Notification> findByIdAndRecipientId(Long id, Long recipientId);
}
