package com.geochat.auth.security;

import java.io.IOException;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.dao.DataAccessException;
import org.springframework.transaction.TransactionException;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private final JwtService jwtService;
	private final UserDetailsService userDetailsService;

	public JwtAuthenticationFilter(JwtService jwtService, UserDetailsService userDetailsService) {
		this.jwtService = jwtService;
		this.userDetailsService = userDetailsService;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {
		String header = request.getHeader("Authorization");

		if (header != null && header.startsWith("Bearer ")) {
			String token = header.substring(7);
			if (jwtService.isTokenValid(token)) {
				try {
					String username = jwtService.getUsername(token);
					UserDetails userDetails = userDetailsService.loadUserByUsername(username);
					if (!userDetails.isEnabled() || !userDetails.isAccountNonLocked()
							|| (userDetails instanceof AccountPrincipal principal && !principal.accepts(jwtService, token))) {
						SecurityContextHolder.clearContext();
						filterChain.doFilter(request, response);
						return;
					}
					UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
							userDetails, null, userDetails.getAuthorities());
					authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
					SecurityContextHolder.getContext().setAuthentication(authentication);
				} catch (UsernameNotFoundException exception) {
					SecurityContextHolder.clearContext();
				} catch (DataAccessException | TransactionException exception) {
					// A failed user lookup during an outage does not invalidate the JWT.
					SecurityContextHolder.clearContext();
					response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
					response.setContentType("application/json");
					response.setCharacterEncoding("UTF-8");
					response.setHeader("Cache-Control", "no-store");
					response.setHeader("Retry-After", "5");
					response.getWriter().write("{\"success\":false,\"data\":null,\"message\":\"Service temporarily unavailable. Please try again.\"}");
					return;
				}
			}
		}

		filterChain.doFilter(request, response);
	}
}
