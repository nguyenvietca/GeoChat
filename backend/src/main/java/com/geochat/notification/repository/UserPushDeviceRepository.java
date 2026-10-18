package com.geochat.notification.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.geochat.notification.entity.UserPushDevice;

public interface UserPushDeviceRepository extends JpaRepository<UserPushDevice, Long> {

    Optional<UserPushDevice> findByPushToken(String pushToken);

    Optional<UserPushDevice> findByIdAndUserId(Long id, Long userId);

    @org.springframework.data.jpa.repository.Query("""
        select d from UserPushDevice d, User u
        where d.userId = u.id and d.userId = :userId and d.active = true
          and u.status = com.geochat.user.entity.UserStatus.ACTIVE
        """)
    List<UserPushDevice> findByUserIdAndActiveTrue(@org.springframework.data.repository.query.Param("userId") Long userId);
}
