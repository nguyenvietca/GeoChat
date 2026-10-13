package com.geochat.notification.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.geochat.notification.entity.NotificationPreference;

public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, Long> {}
