package com.geochat.user.entity;

public enum UserRole {
    USER, ADMIN, SUPER_ADMIN;

    public boolean isAdmin() { return this == ADMIN || this == SUPER_ADMIN; }
}
