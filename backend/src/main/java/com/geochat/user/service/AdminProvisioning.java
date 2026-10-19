package com.geochat.user.service;

import java.time.Instant;
import com.geochat.user.entity.*;
import com.geochat.user.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Operator-only service. Intentionally has no HTTP controller or role-management UI. */
@Service
public class AdminProvisioning {
    private final UserRepository users;
    private final JdbcTemplate jdbc;
    private final ApplicationEventPublisher events;
    public AdminProvisioning(UserRepository users, JdbcTemplate jdbc, ApplicationEventPublisher events) {
        this.users=users;this.jdbc=jdbc;this.events=events;
    }
    @Transactional
    public void change(long id, String action, String confirmation, String reason) {
        if (!java.util.Set.of("GRANT_ADMIN","REVOKE_ADMIN").contains(action) || !confirmation.equals(action+":"+id))
            throw new IllegalArgumentException("Confirm the exact action and existing user ID.");
        if(reason==null || reason.isBlank() || reason.strip().length()>500) throw new IllegalArgumentException("Provide an operator reason (1–500 characters).");
        users.lockAdministrators();
        User user=users.lockById(id).orElseThrow(()->new EntityNotFoundException("User not found."));
        UserRole previous=user.getRole();
        if(action.equals("GRANT_ADMIN")) {
            if(previous.isAdmin()) return;
            if(user.getStatus()!=UserStatus.ACTIVE) throw new IllegalArgumentException("Only an active existing user can receive Admin privileges.");
            user.setRole(UserRole.ADMIN);
        } else {
            if(!previous.isAdmin()) return;
            if(user.getStatus()==UserStatus.ACTIVE && users.countActiveAdministrators()<=1)
                throw new IllegalArgumentException("Provision another active administrator before revoking the final active administrator.");
            user.setRole(UserRole.USER);
        }
        user.setAuthVersion(user.getAuthVersion()+1);user.setUpdatedAt(Instant.now());users.saveAndFlush(user);
        jdbc.update("INSERT INTO account_actions(actor_id,user_id,action,reason,created_at,previous_status,new_status,previous_role,new_role) VALUES (?,?,?,?,?,?,?,?,?)",
                0L,id,action,reason.strip(),java.sql.Timestamp.from(Instant.now()),user.getStatus().name(),user.getStatus().name(),previous.name(),user.getRole().name());
        events.publishEvent(new AccountLifecycleService.AccessChanged(id));
    }
}
