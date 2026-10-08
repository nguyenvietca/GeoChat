package com.geochat.chat.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "conversation_participants")
public class ConversationParticipant {

    @EmbeddedId
    private ConversationParticipantId id;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false, length = 16)
    private String role = "MEMBER";

    public ConversationParticipant() {
    }

    public ConversationParticipant(Long conversationId, Long userId) {
        this.id = new ConversationParticipantId(conversationId, userId);
    }

    public ConversationParticipantId getId() {
        return id;
    }

    public void setId(ConversationParticipantId id) {
        this.id = id;
    }

    public Long getConversationId() {
        return id != null ? id.getConversationId() : null;
    }

    public Long getUserId() {
        return id != null ? id.getUserId() : null;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }
}
