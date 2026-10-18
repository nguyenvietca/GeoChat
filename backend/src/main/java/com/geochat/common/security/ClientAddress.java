package com.geochat.common.security;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Only an explicitly trusted socket peer can supply Nginx's overwritten X-Real-IP. */
@Component
public class ClientAddress {
    private final List<String> proxies;

    public ClientAddress(@Value("${app.security.trusted-proxy-hosts:}") String hosts) {
        proxies = Arrays.stream(hosts.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        if (proxies.stream().anyMatch(s -> s.contains("/") || s.contains("*") || s.contains(":" ) && !s.matches("[0-9a-fA-F:]+")))
            throw new IllegalStateException("Trusted proxies must be exact IP addresses or DNS hostnames.");
    }

    public String resolve(HttpServletRequest request) {
        String peer = request.getRemoteAddr();
        if (trusted(peer)) {
            String header = request.getHeader("X-Real-IP");
            // A single literal only: no chains, ports, hostname lookup or client-controlled XFF.
            if (header != null && header.length() <= 45 && header.matches("[0-9a-fA-F:.]+")
                    && (header.contains(":") || header.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}"))) {
                try { return InetAddress.getByName(header).getHostAddress(); }
                catch (java.net.UnknownHostException ignored) { }
            }
        }
        return peer;
    }

    private boolean trusted(String peer) {
        for (String proxy : proxies) {
            try {
                for (InetAddress address : InetAddress.getAllByName(proxy))
                    if (address.getHostAddress().equals(peer)) return true;
            } catch (java.net.UnknownHostException ignored) { /* Fail closed during proxy DNS outage. */ }
        }
        return false;
    }
}
