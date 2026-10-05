package com.geochat.notification.service;

import java.time.Instant;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.geochat.notification.dto.PushDeviceResponse;
import com.geochat.notification.dto.RegisterPushDeviceRequest;
import com.geochat.notification.entity.UserPushDevice;
import com.geochat.notification.repository.UserPushDeviceRepository;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;

import jakarta.persistence.EntityNotFoundException;

@Service
public class PushDeviceService {

    private final UserPushDeviceRepository pushDeviceRepository;
    private final UserRepository userRepository;

    public PushDeviceService(UserPushDeviceRepository pushDeviceRepository, UserRepository userRepository) {
        this.pushDeviceRepository = pushDeviceRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public PushDeviceResponse register(String username, RegisterPushDeviceRequest request) {
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));

        UserPushDevice device = pushDeviceRepository.findByPushToken(request.token()).orElseGet(() -> {
            UserPushDevice newDevice = new UserPushDevice();
            newDevice.setUserId(user.getId());
            newDevice.setPushToken(request.token());
            return newDevice;
        });

        if (!device.getUserId().equals(user.getId())) {
            throw new AccessDeniedException("Push token is already registered to another user");
        }

        device.setPlatform(request.platform());
        device.setActive(true);
        device.setUpdatedAt(Instant.now());
        UserPushDevice saved = pushDeviceRepository.save(device);
        return new PushDeviceResponse(saved.getId(), saved.getPlatform(), saved.getCreatedAt());
    }

    @Transactional
    public void deactivate(String username, Long deviceId) {
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        UserPushDevice device = pushDeviceRepository.findByIdAndUserId(deviceId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Push device not found"));
        device.setActive(false);
        device.setUpdatedAt(Instant.now());
        pushDeviceRepository.save(device);
    }
}