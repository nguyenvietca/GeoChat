package com.geochat.notification.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.geochat.notification.entity.UserPushDevice;

public interface UserPushDeviceRepository extends JpaRepository<UserPushDevice, Long> {

    Optional<UserPushDevice> findByPushToken(String pushToken);

    Optional<UserPushDevice> findByIdAndUserId(Long id, Long userId);

    List<UserPushDevice> findByUserIdAndActiveTrue(Long userId);
}