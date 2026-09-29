package com.geochat.auth.service;

import com.geochat.auth.dto.AuthResponse;
import com.geochat.auth.dto.LoginRequest;
import com.geochat.auth.security.JwtService;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByUsernameIgnoreCase(request.username())
                .orElseThrow(() -> new BadCredentialsException("Invalid username or password"));

        boolean matches = passwordEncoder.matches(request.password(), user.getPasswordHash());

        if (!matches) {
            throw new BadCredentialsException("Invalid username or password");
        }

        String token = jwtService.generateToken(user.getId(), user.getUsername());
        return new AuthResponse(token, "Bearer");
    }
}
