package com.geochat.auth.service;

import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.geochat.auth.dto.AuthResponse;
import com.geochat.auth.dto.LoginRequest;
import com.geochat.auth.security.JwtService;
import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;

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

		boolean matches = user.isPasswordLoginEnabled()
				&& passwordEncoder.matches(request.password(), user.getPasswordHash());

		if (!matches) {
			throw new BadCredentialsException("Invalid username or password");
		}
		if (user.getStatus() == com.geochat.user.entity.UserStatus.LOCKED)
			throw new org.springframework.security.access.AccessDeniedException("This account is blocked. Contact an administrator.");

		String token = jwtService.generateToken(user.getId(), user.getUsername(), user.getAuthVersion());
		return new AuthResponse(token, "Bearer");
	}
}
