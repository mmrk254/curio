package com.curio.backend;

import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

final class ApiUtil {
    private ApiUtil() {
    }

    static String str(Map<String, Object> body, String key) {
        Object value = body.get(key);
        return value == null ? null : value.toString().trim();
    }

    static String required(Map<String, Object> body, String key) {
        String value = str(body, key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(key + " is required");
        }
        return value;
    }

    static UUID uuid(Map<String, Object> body, String key) {
        String value = str(body, key);
        return value == null || value.isBlank() ? null : UUID.fromString(value);
    }

    static String token(String email, UUID schoolId) {
        String raw = email + "|" + schoolId + "|" + Instant.now();
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    static void audit(JdbcTemplate jdbc, UUID schoolId, String actorEmail, String action, String entityType, UUID entityId, String details) {
        jdbc.update("""
                INSERT INTO audit_logs (school_id, actor_email, action, entity_type, entity_id, details)
                VALUES (?, ?, ?, ?, ?, ?)
                """, schoolId, actorEmail, action, entityType, entityId, details);
    }
}
