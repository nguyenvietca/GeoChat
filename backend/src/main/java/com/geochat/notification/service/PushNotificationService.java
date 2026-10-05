package com.geochat.notification.service;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.geochat.notification.entity.UserPushDevice;
import com.geochat.notification.repository.UserPushDeviceRepository;

@Service
public class PushNotificationService {

    private static final Logger logger = LoggerFactory.getLogger(PushNotificationService.class);

    private final UserPushDeviceRepository pushDeviceRepository;
    private final ExpoPushGateway expoPushGateway;
    private final boolean enabled;

    public PushNotificationService(
            UserPushDeviceRepository pushDeviceRepository,
            ExpoPushGateway expoPushGateway,
            @Value("${push-notifications.enabled:false}") boolean enabled) {
        this.pushDeviceRepository = pushDeviceRepository;
        this.expoPushGateway = expoPushGateway;
        this.enabled = enabled;
    }

    public void send(Long recipientId, String title, String body, Map<String, Object> data) {
        if (!enabled) {
            return;
        }

        try {
            List<UserPushDevice> devices = pushDeviceRepository.findByUserIdAndActiveTrue(recipientId);
            for (UserPushDevice device : devices) {
                try {
                    if (expoPushGateway.send(device.getPushToken(), title, body, data)) {
                        deactivate(device);
                    }
                } catch (RuntimeException exception) {
                    logger.warn("Push delivery failed for device {}", device.getId(), exception);
                }
            }
        } catch (RuntimeException exception) {
            logger.warn("Unable to load push devices for recipient {}", recipientId, exception);
        }
    }

    @Transactional
    public void deactivate(UserPushDevice device) {
        device.setActive(false);
        device.setUpdatedAt(Instant.now());
        pushDeviceRepository.save(device);
    }
}