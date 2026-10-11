package com.geochat.location.service;
import org.springframework.stereotype.Component;
import java.util.*;
@Component
public class NearbyRequestGuard {
 private record Window(long start,int count) {}
 private final Map<String,Window> windows=new HashMap<>();
 public synchronized void check(String key,int limit){
  long now=System.currentTimeMillis();windows.entrySet().removeIf(entry->now-entry.getValue().start()>=60000);
  var previous=windows.getOrDefault(key,new Window(now,0));
  if(previous.count()>=limit||(!windows.containsKey(key)&&windows.size()>=10000))throw new RateLimitException();
  windows.put(key,new Window(previous.start(),previous.count()+1));
 }
 public static class RateLimitException extends RuntimeException {}
}
