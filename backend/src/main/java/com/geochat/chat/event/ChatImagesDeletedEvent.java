package com.geochat.chat.event;
import java.util.List;
public record ChatImagesDeletedEvent(List<String> keys) {}
