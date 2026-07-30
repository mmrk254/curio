package com.curio.backend;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;

    public AuthController(JdbcTemplate jdbc, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/register")
    ResponseEntity<Map<String, Object>> register(@Valid @RequestBody RegisterRequest request) {
        UUID schoolId = jdbc.queryForObject("""
                INSERT INTO schools (name, email, phone, country, region, school_type, motto, logo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, request.schoolName(), request.email(), request.phone(), request.country(), request.region(),
                request.schoolType(), request.motto(), request.logo());

        UUID roleId = jdbc.queryForObject("""
                INSERT INTO roles (school_id, name, description)
                VALUES (?, 'ADMIN', 'School administrator')
                RETURNING id
                """, UUID.class, schoolId);

        UUID userId = jdbc.queryForObject("""
                INSERT INTO users (school_id, role_id, full_name, email, password_hash)
                VALUES (?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, schoolId, roleId, "School Administrator", request.email(),
                passwordEncoder.encode(request.password()));

        ApiUtil.audit(jdbc, schoolId, request.email(), "REGISTER_SCHOOL", "schools", schoolId, request.schoolName());

        return ResponseEntity.ok(sessionPayload(request.email(), schoolId, userId));
    }

    @PostMapping("/login")
    ResponseEntity<Map<String, Object>> login(@Valid @RequestBody LoginRequest request) {
        Map<String, Object> user = jdbc.queryForMap("""
                SELECT u.id, u.school_id, u.password_hash, s.name AS school_name
                FROM users u
                JOIN schools s ON s.id = u.school_id
                WHERE u.email = ?
                """, request.email());

        if (!passwordEncoder.matches(request.password(), user.get("password_hash").toString())) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid email or password"));
        }

        UUID schoolId = (UUID) user.get("school_id");
        UUID userId = (UUID) user.get("id");
        ApiUtil.audit(jdbc, schoolId, request.email(), "LOGIN", "users", userId, "Successful login");

        return ResponseEntity.ok(sessionPayload(request.email(), schoolId, userId));
    }

    private Map<String, Object> sessionPayload(String email, UUID schoolId, UUID userId) {
        Map<String, Object> school = jdbc.queryForMap("SELECT * FROM schools WHERE id = ?", schoolId);
        Map<String, Object> user = jdbc.queryForMap("SELECT id, full_name, email, status, role_id FROM users WHERE id = ?", userId);
        return Map.of(
                "token", ApiUtil.token(email, schoolId),
                "school", school,
                "user", user
        );
    }

    record RegisterRequest(
            @NotBlank String schoolName,
            @Email @NotBlank String email,
            @NotBlank String password,
            String phone,
            @NotBlank String country,
            @NotBlank String region,
            @NotBlank String schoolType,
            String motto,
            String logo
    ) {
    }

    record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {
    }
}
