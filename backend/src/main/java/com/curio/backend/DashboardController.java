package com.curio.backend;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
    private final JdbcTemplate jdbc;

    public DashboardController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    Map<String, Object> dashboard(@RequestParam UUID schoolId) {
        return Map.of(
                "metrics", Map.of(
                        "students", count("students", schoolId),
                        "teachers", count("teachers", schoolId),
                        "parents", count("parents", schoolId),
                        "classes", count("classes", schoolId),
                        "openApplications", countWhere("applications", schoolId, "status <> 'APPROVED'"),
                        "outstandingBalance", decimal("SELECT COALESCE(SUM(balance), 0) FROM invoices WHERE school_id = ?", schoolId),
                        "paymentsToday", decimal("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE school_id = ? AND paid_at::date = CURRENT_DATE", schoolId),
                        "presentToday", countWhere("attendance", schoolId, "attendance_date = CURRENT_DATE AND status = 'PRESENT'")
                ),
                "recentPayments", rows("""
                        SELECT p.id, p.amount, p.channel, p.reference, p.paid_at, s.first_name, s.last_name, i.invoice_no
                        FROM payments p
                        LEFT JOIN students s ON s.id = p.student_id
                        LEFT JOIN invoices i ON i.id = p.invoice_id
                        WHERE p.school_id = ?
                        ORDER BY p.paid_at DESC
                        LIMIT 8
                        """, schoolId),
                "applications", rows("""
                        SELECT id, applicant_name, target_class, guardian_name, guardian_phone, status, created_at
                        FROM applications
                        WHERE school_id = ?
                        ORDER BY created_at DESC
                        LIMIT 8
                        """, schoolId),
                "alerts", rows("""
                        SELECT id, channel, subject, message, status, created_at
                        FROM notifications
                        WHERE school_id = ?
                        ORDER BY created_at DESC
                        LIMIT 8
                        """, schoolId),
                "classHealth", rows("""
                        SELECT c.id, c.name, COUNT(s.id) AS students
                        FROM classes c
                        LEFT JOIN students s ON s.class_id = c.id
                        WHERE c.school_id = ?
                        GROUP BY c.id, c.name
                        ORDER BY c.name
                        LIMIT 8
                        """, schoolId)
        );
    }

    private int count(String table, UUID schoolId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE school_id = ?", Integer.class, schoolId);
    }

    private int countWhere(String table, UUID schoolId, String where) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE school_id = ? AND " + where, Integer.class, schoolId);
    }

    private Number decimal(String sql, UUID schoolId) {
        return jdbc.queryForObject(sql, Number.class, schoolId);
    }

    private List<Map<String, Object>> rows(String sql, UUID schoolId) {
        return jdbc.queryForList(sql, schoolId);
    }
}
