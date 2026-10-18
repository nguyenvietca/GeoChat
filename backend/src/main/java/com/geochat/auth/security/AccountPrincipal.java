package com.geochat.auth.security;

import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import com.geochat.user.entity.User;
import com.geochat.user.entity.UserStatus;

public record AccountPrincipal(User account) implements UserDetails {
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" +
                (account.getStatus() == UserStatus.INACTIVE ? "INACTIVE" : account.getRole().name())));
    }
    public String getPassword() { return account.getPasswordHash(); }
    public String getUsername() { return account.getUsername(); }
    public boolean isEnabled() { return account.getStatus() != UserStatus.LOCKED; }
    public boolean isAccountNonLocked() { return account.getStatus() != UserStatus.LOCKED; }
    public boolean accepts(JwtService jwt, String token) {
        return isEnabled() && isAccountNonLocked() && account.getId().equals(jwt.getUserId(token))
                && account.getAuthVersion() == jwt.getAuthVersion(token);
    }
}
