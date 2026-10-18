package com.geochat.user.exception;

public class EmailAlreadyUsedException extends RuntimeException {
    public EmailAlreadyUsedException() {
        super("This email is already in use. Please choose a different email address.");
    }
}
