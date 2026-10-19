package com.geochat.user.exception;

public class AccountStateConflict extends RuntimeException {
    public AccountStateConflict(String message) { super(message); }
}
