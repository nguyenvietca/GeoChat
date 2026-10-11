package com.geochat.chat.repository;

import com.geochat.chat.entity.MessageReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface MessageReactionRepository extends JpaRepository<MessageReaction, Long> {
    boolean existsByMessageIdAndUserIdAndEmoji(Long messageId, Long userId, String emoji);
    long deleteByMessageIdAndUserIdAndEmoji(Long messageId, Long userId, String emoji);

    interface SummaryRow {
        Long getMessageId();
        String getEmoji();
        long getReactionCount();
        long getMyCount();
    }

    @Query("SELECT r.messageId AS messageId, r.emoji AS emoji, COUNT(r) AS reactionCount, "
            + "SUM(CASE WHEN r.userId = :userId THEN 1 ELSE 0 END) AS myCount "
            + "FROM MessageReaction r WHERE r.messageId IN :messageIds GROUP BY r.messageId, r.emoji")
    List<SummaryRow> summarize(List<Long> messageIds, Long userId);
}
