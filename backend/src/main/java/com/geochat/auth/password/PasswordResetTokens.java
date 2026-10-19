package com.geochat.auth.password;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface PasswordResetTokens extends JpaRepository<PasswordResetToken, Long> {
    Optional<PasswordResetToken> findByTokenHash(String hash);
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from PasswordResetToken t where t.tokenHash = :hash")
    Optional<PasswordResetToken> lockByHash(@Param("hash") String hash);
    void deleteByUserId(Long userId);
    void deleteByExpiresAtBefore(java.time.Instant now);
}
