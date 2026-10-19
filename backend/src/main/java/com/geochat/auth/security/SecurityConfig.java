package com.geochat.auth.security;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.geochat.common.security.AbuseRateLimitFilter;

import jakarta.servlet.http.HttpServletResponse;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

	private final JwtAuthenticationFilter jwtAuthenticationFilter;
	@Value("${app.cors.allowed-origins}")
	private List<String> allowedOrigins;

	public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
		this.jwtAuthenticationFilter = jwtAuthenticationFilter;
	}

	@Bean
	public SecurityFilterChain securityFilterChain(HttpSecurity http, AbuseRateLimitFilter abuseRateLimitFilter)
			throws Exception {
		http.cors(cors -> cors.configurationSource(corsConfigurationSource())).csrf(AbstractHttpConfigurer::disable)
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.authorizeHttpRequests(auth -> auth
						.requestMatchers(HttpMethod.POST, "/api/v1/auth/register", "/api/v1/auth/login").permitAll()
						.requestMatchers("/api/v1/auth/password/**").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/v1/users/me/reactivate").hasRole("INACTIVE")
						.requestMatchers("/api/v1/admin/users/*/conversation").hasRole("SUPER_ADMIN")
						.requestMatchers("/api/v1/admin/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
						.requestMatchers(HttpMethod.GET, "/api/v1/auth/registration-config").permitAll()
						.requestMatchers("/api/v1/auth/google/config", "/api/v1/auth/google/start",
								"/api/v1/auth/google/complete", "/api/v1/auth/google/cancel")
						.permitAll().requestMatchers("/ws/**", "/ws").permitAll()
						.requestMatchers(HttpMethod.GET, "/api/health").permitAll()
						.requestMatchers(HttpMethod.GET, "/api/v1/users/me").authenticated().anyRequest()
						.hasAnyRole("USER", "ADMIN", "SUPER_ADMIN"))
				.exceptionHandling(ex -> ex
						.authenticationEntryPoint((request, response, authException) -> writeSecurityError(response,
								HttpServletResponse.SC_UNAUTHORIZED, "Authentication required"))
						.accessDeniedHandler((request, response, denied) -> writeSecurityError(response,
								HttpServletResponse.SC_FORBIDDEN, "Access denied")))
				.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
				.addFilterAfter(abuseRateLimitFilter, JwtAuthenticationFilter.class);

		return http.build();
	}

	private void writeSecurityError(HttpServletResponse response, int status, String message)
			throws java.io.IOException {
		response.setStatus(status);
		response.setContentType("application/json");
		response.setCharacterEncoding("UTF-8");
		response.getWriter().write("{\"success\":false,\"data\":null,\"message\":\"" + message + "\"}");
	}

	@Bean
	public AbuseRateLimitFilter abuseRateLimitFilter(
			@Value("${app.security.rate-limit.enabled:true}") boolean enabled,
			com.geochat.common.security.ClientAddress addresses) {
		return new AbuseRateLimitFilter(enabled, addresses);
	}

	@Bean
	public FilterRegistrationBean<AbuseRateLimitFilter> disableContainerRegistration(AbuseRateLimitFilter filter) {
		FilterRegistrationBean<AbuseRateLimitFilter> registration = new FilterRegistrationBean<>(filter);
		registration.setEnabled(false);
		return registration;
	}

	@Bean
	public CorsConfigurationSource corsConfigurationSource() {
		CorsConfiguration configuration = new CorsConfiguration();
		configuration.setAllowedOrigins(allowedOrigins);
		configuration.setAllowCredentials(true);
		configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		configuration.setAllowedHeaders(List.of("Accept", "Authorization", "Content-Type"));
		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/api/**", configuration);
		return source;
	}

	@Bean
	public PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	@Bean
	public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
		return configuration.getAuthenticationManager();
	}
}
