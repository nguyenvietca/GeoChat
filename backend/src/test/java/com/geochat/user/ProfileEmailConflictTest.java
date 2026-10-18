package com.geochat.user;

import com.geochat.user.dto.UpdateMyProfileRequest;
import com.geochat.user.entity.User;
import com.geochat.user.exception.EmailAlreadyUsedException;
import com.geochat.user.repository.UserRepository;
import com.geochat.user.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProfileEmailConflictTest {
    @Test void concurrentDuplicateEmailIsTranslatedButUnrelatedDatabaseErrorsAreNot() {
        var users = mock(UserRepository.class);
        User user = new User(); user.setUsername("editor");
        when(users.findByUsernameIgnoreCase("editor")).thenReturn(java.util.Optional.of(user));
        var service = new UserService(users, null, null, null);
        var request = new UpdateMyProfileRequest("New name", "taken@example.com", null);
        var sql = new java.sql.SQLException("duplicate", "23505");
        when(users.saveAndFlush(user)).thenThrow(new DataIntegrityViolationException("duplicate",
                new org.hibernate.exception.ConstraintViolationException("duplicate", sql, "uq_users_email_ci")));
        assertThatThrownBy(() -> service.updateCurrentUser("editor", request)).isInstanceOf(EmailAlreadyUsedException.class);
        doThrow(new DataIntegrityViolationException("unrelated")).when(users).saveAndFlush(user);
        assertThatThrownBy(() -> service.updateCurrentUser("editor", request)).isInstanceOf(DataIntegrityViolationException.class);
    }
}
