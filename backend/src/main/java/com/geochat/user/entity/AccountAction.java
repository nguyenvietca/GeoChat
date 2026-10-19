package com.geochat.user.entity;

import java.time.Instant;
import jakarta.persistence.*;

/** Append-only audit rows, retained even after later account deletion. */
@Entity
@Table(name = "account_actions")
public class AccountAction {
    @Column(name="previous_status",length=16) private String previousStatus;
    @Column(name="new_status",length=16) private String newStatus;
    @Column(name="previous_role",length=16) private String previousRole;
    @Column(name="new_role",length=16) private String newRole;
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "actor_id", nullable = false)
    private Long actorId;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(nullable = false, length = 32)
    private String action;
    @Column(length = 500)
    private String reason;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
