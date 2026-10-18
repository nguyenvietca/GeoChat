package com.geochat.common.security;

public class RequestLimitException extends RuntimeException {
    private final long retryAfter;

    public RequestLimitException(long retryAfter) {
        super("Too many requests. Please wait and try again.");
        this.retryAfter = Math.max(1, retryAfter);
    }

    public long retryAfter() { return retryAfter; }
}
