package com.geochat.auth.google;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GoogleIdentityRepository extends JpaRepository<GoogleIdentity, Long> {
	Optional<GoogleIdentity> findByProviderAndSubject(String provider, String subject);

	Optional<GoogleIdentity> findByUserIdAndProvider(Long userId, String provider);
}
