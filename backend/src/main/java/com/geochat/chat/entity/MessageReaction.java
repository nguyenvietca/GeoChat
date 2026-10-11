package com.geochat.chat.entity;

import com.geochat.user.entity.User;
import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import java.time.Instant;

@Entity
@Table(name = "message_reactions", uniqueConstraints = @UniqueConstraint(
        name = "uq_message_reaction", columnNames = {"message_id", "user_id", "emoji"}))
public class MessageReaction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "message_id", nullable = false)
    private Long messageId;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(nullable = false, length = 16)
    private String emoji;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    // Associations also create cascade FKs in the Hibernate-generated test schema.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "message_id", insertable = false, updatable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Message message;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    protected MessageReaction() {}
    public MessageReaction(Long messageId, Long userId, String emoji) {
        this.messageId = messageId;
        this.userId = userId;
        this.emoji = emoji;
    }
}
