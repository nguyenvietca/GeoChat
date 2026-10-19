package com.geochat.user.service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityNotFoundException;

/** Bounded projections only: no password hashes, provider subjects, locations or messages. */
@Service
@Transactional(readOnly = true)
public class AdminQueries {
    private final JdbcTemplate jdbc;
    public AdminQueries(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Item(Long id, String username, String displayName, String email, String status,
            String role, String blockReason, Instant createdAt, List<String> providers) {}
    public record Page<T>(List<T> items, boolean hasMore, long total, int page, int size) {}
    public record Audit(Long id, Long actorId, String actor, Long targetId, String target, String action,
            String reason, Instant createdAt, String previousStatus, String newStatus, String previousRole, String newRole) {}
    public record Detail(Item user, List<Audit> history) {}
    private static final String USER_COLUMNS = "u.id,u.username,u.display_name,u.email,u.status,u.role,u.block_reason,u.created_at,u.password_login_enabled";
    private static final String AUDIT_FROM = " FROM account_actions a LEFT JOIN users actor ON actor.id=a.actor_id LEFT JOIN users target ON target.id=a.user_id";
    private static final Set<String> ACTIONS = Set.of("BLOCK", "UNBLOCK", "DEACTIVATE", "REACTIVATE", "GRANT_ADMIN", "REVOKE_ADMIN", "GRANT_SUPER_ADMIN");

    private record Filter(String where, List<Object> values) {}
    private void pages(int page, int size) {
        if (page < 0 || page > 10000 || size < 1 || size > 100) throw new IllegalArgumentException("Page must be 0–10000 and size 1–100.");
    }
    private void dates(Instant after, Instant before) {
        if (after != null && before != null && !after.isBefore(before)) throw new IllegalArgumentException("Start date must precede end date.");
    }
    private Filter userFilter(String query, String status, String provider, Instant after, Instant before) {
        if (query.length() > 100) throw new IllegalArgumentException("Search must be at most 100 characters.");
        dates(after,before);
        StringBuilder sql = new StringBuilder(" WHERE 1=1"); List<Object> values = new ArrayList<>();
        if (!query.isBlank()) {
            sql.append(" AND (lower(u.username) LIKE ? ESCAPE '!' OR lower(u.email) LIKE ? ESCAPE '!' OR lower(u.display_name) LIKE ? ESCAPE '!')");
            String pattern = "%" + query.strip().toLowerCase(Locale.ROOT).replace("!","!!").replace("%","!%").replace("_","!_") + "%";
            values.add(pattern); values.add(pattern); values.add(pattern);
        }
        if (status != null && !status.isBlank()) {
            if (!Set.of("ACTIVE","INACTIVE","LOCKED").contains(status)) throw new IllegalArgumentException("Invalid status filter.");
            sql.append(" AND u.status=?"); values.add(status);
        }
        if (provider != null && !provider.isBlank()) {
            if (!Set.of("PASSWORD","GOOGLE","FACEBOOK").contains(provider)) throw new IllegalArgumentException("Invalid provider filter.");
            if (provider.equals("PASSWORD")) sql.append(" AND u.password_login_enabled=TRUE");
            else { sql.append(" AND EXISTS (SELECT 1 FROM user_auth_identities i WHERE i.user_id=u.id AND i.provider=?)"); values.add(provider); }
        }
        if (after != null) { sql.append(" AND u.created_at>=?"); values.add(java.sql.Timestamp.from(after)); }
        if (before != null) { sql.append(" AND u.created_at<?"); values.add(java.sql.Timestamp.from(before)); }
        return new Filter(sql.toString(),values);
    }
    private Item item(ResultSet row, int index) throws SQLException {
        var providers = new ArrayList<String>(); if (row.getBoolean("password_login_enabled")) providers.add("PASSWORD");
        return new Item(row.getLong("id"),row.getString("username"),row.getString("display_name"),row.getString("email"),
                row.getString("status"),row.getString("role"),row.getString("block_reason"),row.getTimestamp("created_at").toInstant(),providers);
    }
    private void providers(List<Item> rows) {
        if (rows.isEmpty()) return;
        Map<Long,Item> byId = new HashMap<>(); rows.forEach(row->byId.put(row.id(),row));
        String placeholders = String.join(",",Collections.nCopies(rows.size(),"?"));
        jdbc.query("SELECT user_id,provider FROM user_auth_identities WHERE user_id IN ("+placeholders+") ORDER BY provider",
                (org.springframework.jdbc.core.RowCallbackHandler) row -> byId.get(row.getLong("user_id")).providers().add(row.getString("provider")),byId.keySet().toArray());
    }
    public Page<Item> users(String query, String status, String provider, Instant after, Instant before, int page, int size) {
        pages(page,size); var filter=userFilter(query,status,provider,after,before);
        long total=jdbc.queryForObject("SELECT count(*) FROM users u"+filter.where(),Long.class,filter.values().toArray());
        var parameters=new ArrayList<>(filter.values()); parameters.add(size); parameters.add(page*size);
        var rows=jdbc.query("SELECT "+USER_COLUMNS+" FROM users u"+filter.where()+" ORDER BY u.created_at DESC,u.id DESC LIMIT ? OFFSET ?",this::item,parameters.toArray());
        providers(rows); return new Page<>(rows,((long)page+1)*size<total,total,page,size);
    }
    public Detail detail(Long id) {
        var rows=jdbc.query("SELECT "+USER_COLUMNS+" FROM users u WHERE u.id=?",this::item,id);
        if(rows.isEmpty()) throw new EntityNotFoundException("User not found.");
        providers(rows); return new Detail(rows.getFirst(),audit(null,null,id,null,null,0,20).items());
    }
    public Page<Audit> audit(String action, Long actor, Long target, Instant after, Instant before, int page, int size) {
        pages(page,size); dates(after,before); StringBuilder where=new StringBuilder(" WHERE 1=1"); List<Object> params=new ArrayList<>();
        if(action!=null && !action.isBlank()) { if(!ACTIONS.contains(action)) throw new IllegalArgumentException("Invalid action filter."); where.append(" AND a.action=?");params.add(action); }
        if(actor!=null) { if(actor<0) throw new IllegalArgumentException("Invalid actor."); where.append(" AND a.actor_id=?");params.add(actor); }
        if(target!=null) { if(target<1) throw new IllegalArgumentException("Invalid target.");where.append(" AND a.user_id=?");params.add(target); }
        if(after!=null) {where.append(" AND a.created_at>=?");params.add(java.sql.Timestamp.from(after));}
        if(before!=null) {where.append(" AND a.created_at<?");params.add(java.sql.Timestamp.from(before));}
        long count=jdbc.queryForObject("SELECT count(*) FROM account_actions a"+where,Long.class,params.toArray());
        params.add(size);params.add(page*size);
        var rows=jdbc.query("SELECT a.*,actor.username AS actor_name,target.username AS target_name"+AUDIT_FROM+where+" ORDER BY a.created_at DESC,a.id DESC LIMIT ? OFFSET ?",(r,n)->new Audit(
                r.getLong("id"),r.getLong("actor_id"),r.getLong("actor_id")==0?"Deployment operator":r.getString("actor_name"),r.getLong("user_id"),r.getString("target_name"),
                r.getString("action"),r.getString("reason"),r.getTimestamp("created_at").toInstant(),r.getString("previous_status"),r.getString("new_status"),r.getString("previous_role"),r.getString("new_role")),params.toArray());
        return new Page<>(rows,((long)page+1)*size<count,count,page,size);
    }
}
