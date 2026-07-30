package com.curio.backend;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class CoreDataController {
    private final JdbcTemplate jdbc;

    public CoreDataController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/{resource}")
    List<Map<String, Object>> list(@PathVariable String resource, @RequestParam UUID schoolId) {
        return switch (resource) {
            case "students" -> jdbc.queryForList("""
                    SELECT s.*, c.name AS class_name, p.full_name AS parent_name
                    FROM students s
                    LEFT JOIN classes c ON c.id = s.class_id
                    LEFT JOIN parents p ON p.id = s.parent_id
                    WHERE s.school_id = ?
                    ORDER BY s.created_at DESC
                    """, schoolId);
            case "parents", "teachers", "classes", "streams", "applications", "attendance", "exams", "results",
                    "invoices", "payments", "notifications", "documents", "audit_logs" ->
                    jdbc.queryForList("SELECT * FROM " + resource + " WHERE school_id = ? ORDER BY created_at DESC", schoolId);
            default -> throw new IllegalArgumentException("Unsupported resource: " + resource);
        };
    }

    @PostMapping("/parents")
    Map<String, Object> createParent(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO parents (school_id, full_name, phone, email, relationship, address)
                VALUES (?, ?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, schoolId, ApiUtil.required(body, "fullName"), ApiUtil.str(body, "phone"),
                ApiUtil.str(body, "email"), ApiUtil.str(body, "relationship"), ApiUtil.str(body, "address"));
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "CREATE_PARENT", "parents", id, ApiUtil.str(body, "fullName"));
        return getById("parents", id);
    }

    @PostMapping("/teachers")
    Map<String, Object> createTeacher(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO teachers (school_id, full_name, phone, email, department, employment_type)
                VALUES (?, ?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, schoolId, ApiUtil.required(body, "fullName"), ApiUtil.str(body, "phone"),
                ApiUtil.str(body, "email"), ApiUtil.str(body, "department"), ApiUtil.str(body, "employmentType"));
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "CREATE_TEACHER", "teachers", id, ApiUtil.str(body, "fullName"));
        return getById("teachers", id);
    }

    @PostMapping("/classes")
    Map<String, Object> createClass(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO classes (school_id, name, level, academic_year)
                VALUES (?, ?, ?, ?)
                RETURNING id
                """, UUID.class, schoolId, ApiUtil.required(body, "name"), ApiUtil.str(body, "level"),
                intValue(body.get("academicYear"), LocalDate.now().getYear()));
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "CREATE_CLASS", "classes", id, ApiUtil.str(body, "name"));
        return getById("classes", id);
    }

    @PostMapping("/students")
    Map<String, Object> createStudent(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO students (school_id, parent_id, class_id, admission_no, first_name, last_name, gender, date_of_birth)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, schoolId, ApiUtil.uuid(body, "parentId"), ApiUtil.uuid(body, "classId"),
                ApiUtil.required(body, "admissionNo"), ApiUtil.required(body, "firstName"),
                ApiUtil.required(body, "lastName"), ApiUtil.str(body, "gender"), dateValue(body.get("dateOfBirth")));
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "CREATE_STUDENT", "students", id, ApiUtil.str(body, "admissionNo"));
        return getById("students", id);
    }

    @PostMapping("/applications")
    Map<String, Object> createApplication(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO applications (school_id, applicant_name, target_class, guardian_name, guardian_phone, status)
                VALUES (?, ?, ?, ?, ?, COALESCE(?, 'REVIEW'))
                RETURNING id
                """, UUID.class, schoolId, ApiUtil.required(body, "applicantName"), ApiUtil.str(body, "targetClass"),
                ApiUtil.str(body, "guardianName"), ApiUtil.str(body, "guardianPhone"), ApiUtil.str(body, "status"));
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "CREATE_APPLICATION", "applications", id, ApiUtil.str(body, "applicantName"));
        return getById("applications", id);
    }

    @PostMapping("/attendance")
    Map<String, Object> createAttendance(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO attendance (school_id, student_id, attendance_date, status, notes)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (student_id, attendance_date)
                DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes
                RETURNING id
                """, UUID.class, schoolId, ApiUtil.uuid(body, "studentId"),
                dateValue(body.getOrDefault("attendanceDate", LocalDate.now().toString())),
                ApiUtil.required(body, "status"), ApiUtil.str(body, "notes"));
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "MARK_ATTENDANCE", "attendance", id, ApiUtil.str(body, "status"));
        return getById("attendance", id);
    }

    @PostMapping("/invoices")
    Map<String, Object> createInvoice(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        BigDecimal amount = money(body.get("amount"));
        UUID id = jdbc.queryForObject("""
                INSERT INTO invoices (school_id, student_id, invoice_no, description, amount, balance, due_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, schoolId, ApiUtil.uuid(body, "studentId"), ApiUtil.required(body, "invoiceNo"),
                ApiUtil.str(body, "description"), amount, amount, dateValue(body.get("dueDate")));
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "CREATE_INVOICE", "invoices", id, ApiUtil.str(body, "invoiceNo"));
        return getById("invoices", id);
    }

    @PostMapping("/payments")
    Map<String, Object> createPayment(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID invoiceId = ApiUtil.uuid(body, "invoiceId");
        BigDecimal amount = money(body.get("amount"));
        UUID id = jdbc.queryForObject("""
                INSERT INTO payments (school_id, invoice_id, student_id, amount, channel, reference)
                VALUES (?, ?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, schoolId, invoiceId, ApiUtil.uuid(body, "studentId"),
                amount, ApiUtil.str(body, "channel"), ApiUtil.str(body, "reference"));
        if (invoiceId != null) {
            jdbc.update("""
                    UPDATE invoices
                    SET balance = GREATEST(balance - ?, 0),
                        status = CASE WHEN GREATEST(balance - ?, 0) = 0 THEN 'PAID' ELSE 'OPEN' END
                    WHERE id = ?
                    """, amount, amount, invoiceId);
        }
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "CREATE_PAYMENT", "payments", id, ApiUtil.str(body, "reference"));
        return getById("payments", id);
    }

    @PostMapping("/notifications")
    Map<String, Object> createNotification(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO notifications (school_id, channel, recipient, subject, message, status)
                VALUES (?, ?, ?, ?, ?, COALESCE(?, 'DRAFT'))
                RETURNING id
                """, UUID.class, schoolId, ApiUtil.required(body, "channel"), ApiUtil.str(body, "recipient"),
                ApiUtil.str(body, "subject"), ApiUtil.required(body, "message"), ApiUtil.str(body, "status"));
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "CREATE_NOTIFICATION", "notifications", id, ApiUtil.str(body, "subject"));
        return getById("notifications", id);
    }

    private Map<String, Object> getById(String table, UUID id) {
        return jdbc.queryForMap("SELECT * FROM " + table + " WHERE id = ?", id);
    }

    private int intValue(Object value, int fallback) {
        return value == null || value.toString().isBlank() ? fallback : Integer.parseInt(value.toString());
    }

    private LocalDate dateValue(Object value) {
        return value == null || value.toString().isBlank() ? null : LocalDate.parse(value.toString());
    }

    private BigDecimal money(Object value) {
        if (value == null || value.toString().isBlank()) {
            throw new IllegalArgumentException("amount is required");
        }
        return new BigDecimal(value.toString());
    }
}
