package com.curio.backend;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ModulesController {

    private final JdbcTemplate jdbc;

    public ModulesController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ── Subjects ─────────────────────────────────────────────────────────────

    @PostMapping("/subjects")
    ResponseEntity<Map<String, Object>> createSubject(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO subjects (school_id, class_id, teacher_id, name, code)
                VALUES (?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, schoolId,
                ApiUtil.uuid(body, "classId"),
                ApiUtil.uuid(body, "teacherId"),
                ApiUtil.required(body, "name"),
                ApiUtil.str(body, "code"));
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "CREATE_SUBJECT", "subjects", id, ApiUtil.str(body, "name"));
        return ResponseEntity.ok(getById("subjects", id));
    }

    @GetMapping("/subjects")
    List<Map<String, Object>> listSubjects(@RequestParam UUID schoolId) {
        return jdbc.queryForList("""
                SELECT s.*, c.name AS class_name, t.full_name AS teacher_name
                FROM subjects s
                LEFT JOIN classes c ON c.id = s.class_id
                LEFT JOIN teachers t ON t.id = s.teacher_id
                WHERE s.school_id = ?
                ORDER BY s.created_at DESC
                """, schoolId);
    }

    // ── Fee Structures ────────────────────────────────────────────────────────

    @PostMapping("/fee-structures")
    ResponseEntity<Map<String, Object>> createFeeStructure(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO fee_structures (school_id, name, class_id, term, academic_year, amount, description)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, schoolId,
                ApiUtil.required(body, "name"),
                ApiUtil.uuid(body, "classId"),
                ApiUtil.str(body, "term"),
                intVal(body.get("academicYear"), LocalDate.now().getYear()),
                money(body.get("amount")),
                ApiUtil.str(body, "description"));
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "CREATE_FEE_STRUCTURE", "fee_structures", id, ApiUtil.str(body, "name"));
        return ResponseEntity.ok(getById("fee_structures", id));
    }

    @GetMapping("/fee-structures")
    List<Map<String, Object>> listFeeStructures(@RequestParam UUID schoolId) {
        return jdbc.queryForList("""
                SELECT f.*, c.name AS class_name
                FROM fee_structures f
                LEFT JOIN classes c ON c.id = f.class_id
                WHERE f.school_id = ?
                ORDER BY f.created_at DESC
                """, schoolId);
    }

    // ── Bulk Invoice Generation ───────────────────────────────────────────────

    @PostMapping("/fee-structures/{id}/generate-invoices")
    ResponseEntity<Map<String, Object>> generateInvoices(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        String actorEmail = ApiUtil.str(body, "actorEmail");

        Map<String, Object> fee = jdbc.queryForMap("SELECT * FROM fee_structures WHERE id = ?", id);
        UUID classId = fee.get("class_id") != null ? (UUID) fee.get("class_id") : null;

        List<Map<String, Object>> students;
        if (classId != null) {
            students = jdbc.queryForList("SELECT id, admission_no FROM students WHERE school_id = ? AND class_id = ? AND status = 'ACTIVE'", schoolId, classId);
        } else {
            students = jdbc.queryForList("SELECT id, admission_no FROM students WHERE school_id = ? AND status = 'ACTIVE'", schoolId);
        }

        int count = 0;
        for (Map<String, Object> student : students) {
            UUID studentId = (UUID) student.get("id");
            String invoiceNo = "INV-" + System.currentTimeMillis() % 100000 + "-" + count;
            BigDecimal amount = (BigDecimal) fee.get("amount");
            jdbc.update("""
                    INSERT INTO invoices (school_id, student_id, invoice_no, description, amount, balance, due_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, schoolId, studentId, invoiceNo,
                    fee.get("name"), amount, amount,
                    body.get("dueDate") != null ? LocalDate.parse(body.get("dueDate").toString()) : null);
            count++;
        }

        ApiUtil.audit(jdbc, schoolId, actorEmail, "BULK_INVOICE", "invoices", id, count + " invoices generated");
        return ResponseEntity.ok(Map.of("generated", count));
    }

    // ── Expenses ──────────────────────────────────────────────────────────────

    @PostMapping("/expenses")
    ResponseEntity<Map<String, Object>> createExpense(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO expenses (school_id, category, description, amount, paid_to, payment_date, approved_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, schoolId,
                ApiUtil.required(body, "category"),
                ApiUtil.str(body, "description"),
                money(body.get("amount")),
                ApiUtil.str(body, "paidTo"),
                body.get("paymentDate") != null ? LocalDate.parse(body.get("paymentDate").toString()) : LocalDate.now(),
                ApiUtil.str(body, "approvedBy"));
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "CREATE_EXPENSE", "expenses", id, ApiUtil.str(body, "category"));
        return ResponseEntity.ok(getById("expenses", id));
    }

    @GetMapping("/expenses")
    List<Map<String, Object>> listExpenses(@RequestParam UUID schoolId) {
        return jdbc.queryForList("SELECT * FROM expenses WHERE school_id = ? ORDER BY payment_date DESC", schoolId);
    }

    @GetMapping("/finance/summary")
    Map<String, Object> financeSummary(@RequestParam UUID schoolId) {
        Number totalInvoiced = jdbc.queryForObject("SELECT COALESCE(SUM(amount),0) FROM invoices WHERE school_id = ?", Number.class, schoolId);
        Number totalCollected = jdbc.queryForObject("SELECT COALESCE(SUM(amount),0) FROM payments WHERE school_id = ?", Number.class, schoolId);
        Number totalBalance = jdbc.queryForObject("SELECT COALESCE(SUM(balance),0) FROM invoices WHERE school_id = ?", Number.class, schoolId);
        Number totalExpenses = jdbc.queryForObject("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE school_id = ?", Number.class, schoolId);
        Number paidInvoices = jdbc.queryForObject("SELECT COUNT(*) FROM invoices WHERE school_id = ? AND status = 'PAID'", Number.class, schoolId);
        Number openInvoices = jdbc.queryForObject("SELECT COUNT(*) FROM invoices WHERE school_id = ? AND status = 'OPEN'", Number.class, schoolId);
        return Map.of(
            "totalInvoiced", totalInvoiced,
            "totalCollected", totalCollected,
            "totalBalance", totalBalance,
            "totalExpenses", totalExpenses,
            "paidInvoices", paidInvoices,
            "openInvoices", openInvoices
        );
    }

    // ── Exams & Results ───────────────────────────────────────────────────────

    @PostMapping("/exams")
    ResponseEntity<Map<String, Object>> createExam(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO exams (school_id, name, term, academic_year, starts_on)
                VALUES (?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, schoolId,
                ApiUtil.required(body, "name"),
                ApiUtil.str(body, "term"),
                intVal(body.get("academicYear"), LocalDate.now().getYear()),
                body.get("startsOn") != null ? LocalDate.parse(body.get("startsOn").toString()) : null);
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "CREATE_EXAM", "exams", id, ApiUtil.str(body, "name"));
        return ResponseEntity.ok(getById("exams", id));
    }

    @GetMapping("/exams")
    List<Map<String, Object>> listExams(@RequestParam UUID schoolId) {
        return jdbc.queryForList("SELECT * FROM exams WHERE school_id = ? ORDER BY starts_on DESC", schoolId);
    }

    @PostMapping("/results")
    ResponseEntity<Map<String, Object>> createResult(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        double score = Double.parseDouble(body.get("score").toString());
        String grade = computeGrade(score);
        UUID id = jdbc.queryForObject("""
                INSERT INTO results (school_id, exam_id, student_id, subject, score, grade)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT DO NOTHING
                RETURNING id
                """, UUID.class, schoolId,
                ApiUtil.uuid(body, "examId"),
                ApiUtil.uuid(body, "studentId"),
                ApiUtil.required(body, "subject"),
                new BigDecimal(body.get("score").toString()),
                grade);
        if (id == null) return ResponseEntity.ok(Map.of("message", "Result already exists"));
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "CREATE_RESULT", "results", id, ApiUtil.str(body, "subject"));
        return ResponseEntity.ok(getById("results", id));
    }

    @GetMapping("/results")
    List<Map<String, Object>> listResults(@RequestParam UUID schoolId,
                                          @RequestParam(required = false) UUID examId,
                                          @RequestParam(required = false) UUID studentId) {
        if (examId != null) {
            return jdbc.queryForList("""
                    SELECT r.*, s.first_name, s.last_name, s.admission_no
                    FROM results r
                    JOIN students s ON s.id = r.student_id
                    WHERE r.school_id = ? AND r.exam_id = ?
                    ORDER BY s.last_name, r.subject
                    """, schoolId, examId);
        }
        if (studentId != null) {
            return jdbc.queryForList("""
                    SELECT r.*, e.name AS exam_name
                    FROM results r
                    JOIN exams e ON e.id = r.exam_id
                    WHERE r.school_id = ? AND r.student_id = ?
                    ORDER BY r.created_at DESC
                    """, schoolId, studentId);
        }
        return jdbc.queryForList("""
                SELECT r.*, s.first_name, s.last_name, e.name AS exam_name
                FROM results r
                JOIN students s ON s.id = r.student_id
                JOIN exams e ON e.id = r.exam_id
                WHERE r.school_id = ?
                ORDER BY r.created_at DESC LIMIT 100
                """, schoolId);
    }

    // ── Subjects (timetable) ──────────────────────────────────────────────────

    @PostMapping("/timetable")
    ResponseEntity<Map<String, Object>> createSlot(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO timetable (school_id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room)
                VALUES (?, ?, ?, ?, ?, ?::time, ?::time, ?)
                RETURNING id
                """, UUID.class, schoolId,
                ApiUtil.uuid(body, "classId"),
                ApiUtil.uuid(body, "subjectId"),
                ApiUtil.uuid(body, "teacherId"),
                ApiUtil.required(body, "dayOfWeek"),
                ApiUtil.required(body, "startTime"),
                ApiUtil.required(body, "endTime"),
                ApiUtil.str(body, "room"));
        return ResponseEntity.ok(getById("timetable", id));
    }

    @GetMapping("/timetable")
    List<Map<String, Object>> listTimetable(@RequestParam UUID schoolId,
                                             @RequestParam(required = false) UUID classId) {
        if (classId != null) {
            return jdbc.queryForList("""
                    SELECT t.*, s.name AS subject_name, tc.full_name AS teacher_name, c.name AS class_name
                    FROM timetable t
                    LEFT JOIN subjects s ON s.id = t.subject_id
                    LEFT JOIN teachers tc ON tc.id = t.teacher_id
                    LEFT JOIN classes c ON c.id = t.class_id
                    WHERE t.school_id = ? AND t.class_id = ?
                    ORDER BY t.day_of_week, t.start_time
                    """, schoolId, classId);
        }
        return jdbc.queryForList("""
                SELECT t.*, s.name AS subject_name, tc.full_name AS teacher_name, c.name AS class_name
                FROM timetable t
                LEFT JOIN subjects s ON s.id = t.subject_id
                LEFT JOIN teachers tc ON tc.id = t.teacher_id
                LEFT JOIN classes c ON c.id = t.class_id
                WHERE t.school_id = ?
                ORDER BY t.class_id, t.day_of_week, t.start_time
                """, schoolId);
    }

    // ── Discipline ────────────────────────────────────────────────────────────

    @PostMapping("/discipline")
    ResponseEntity<Map<String, Object>> createIncident(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO discipline (school_id, student_id, incident_date, category, description, action_taken, severity)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, schoolId,
                ApiUtil.uuid(body, "studentId"),
                body.get("incidentDate") != null ? LocalDate.parse(body.get("incidentDate").toString()) : LocalDate.now(),
                ApiUtil.required(body, "category"),
                ApiUtil.str(body, "description"),
                ApiUtil.str(body, "actionTaken"),
                body.getOrDefault("severity", "LOW").toString());
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "CREATE_INCIDENT", "discipline", id, ApiUtil.str(body, "category"));
        return ResponseEntity.ok(getById("discipline", id));
    }

    @GetMapping("/discipline")
    List<Map<String, Object>> listDiscipline(@RequestParam UUID schoolId) {
        return jdbc.queryForList("""
                SELECT d.*, s.first_name, s.last_name, s.admission_no
                FROM discipline d
                LEFT JOIN students s ON s.id = d.student_id
                WHERE d.school_id = ?
                ORDER BY d.incident_date DESC
                """, schoolId);
    }

    // ── Leave Requests ────────────────────────────────────────────────────────

    @PostMapping("/leave-requests")
    ResponseEntity<Map<String, Object>> createLeave(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO leave_requests (school_id, teacher_id, leave_type, start_date, end_date, reason, status)
                VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
                RETURNING id
                """, UUID.class, schoolId,
                ApiUtil.uuid(body, "teacherId"),
                ApiUtil.required(body, "leaveType"),
                LocalDate.parse(ApiUtil.required(body, "startDate")),
                LocalDate.parse(ApiUtil.required(body, "endDate")),
                ApiUtil.str(body, "reason"));
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "CREATE_LEAVE", "leave_requests", id, ApiUtil.str(body, "leaveType"));
        return ResponseEntity.ok(getById("leave_requests", id));
    }

    @GetMapping("/leave-requests")
    List<Map<String, Object>> listLeave(@RequestParam UUID schoolId) {
        return jdbc.queryForList("""
                SELECT l.*, t.full_name AS teacher_name
                FROM leave_requests l
                LEFT JOIN teachers t ON t.id = l.teacher_id
                WHERE l.school_id = ?
                ORDER BY l.created_at DESC
                """, schoolId);
    }

    @PostMapping("/leave-requests/{id}/approve")
    ResponseEntity<Map<String, Object>> approveLeave(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        String status = body.getOrDefault("status", "APPROVED").toString();
        jdbc.update("UPDATE leave_requests SET status = ? WHERE id = ?", status, id);
        return ResponseEntity.ok(getById("leave_requests", id));
    }

    // ── Assets ────────────────────────────────────────────────────────────────

    @PostMapping("/assets")
    ResponseEntity<Map<String, Object>> createAsset(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO assets (school_id, name, category, serial_no, purchase_date, purchase_value, condition, location)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, schoolId,
                ApiUtil.required(body, "name"),
                ApiUtil.str(body, "category"),
                ApiUtil.str(body, "serialNo"),
                body.get("purchaseDate") != null ? LocalDate.parse(body.get("purchaseDate").toString()) : null,
                body.get("purchaseValue") != null ? new BigDecimal(body.get("purchaseValue").toString()) : null,
                body.getOrDefault("condition", "GOOD").toString(),
                ApiUtil.str(body, "location"));
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "CREATE_ASSET", "assets", id, ApiUtil.str(body, "name"));
        return ResponseEntity.ok(getById("assets", id));
    }

    @GetMapping("/assets")
    List<Map<String, Object>> listAssets(@RequestParam UUID schoolId) {
        return jdbc.queryForList("SELECT * FROM assets WHERE school_id = ? ORDER BY created_at DESC", schoolId);
    }

    // ── Library ───────────────────────────────────────────────────────────────

    @PostMapping("/library-books")
    ResponseEntity<Map<String, Object>> createBook(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        int copies = body.get("copiesTotal") != null ? Integer.parseInt(body.get("copiesTotal").toString()) : 1;
        UUID id = jdbc.queryForObject("""
                INSERT INTO library_books (school_id, title, author, isbn, category, copies_total, copies_available)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, schoolId,
                ApiUtil.required(body, "title"),
                ApiUtil.str(body, "author"),
                ApiUtil.str(body, "isbn"),
                ApiUtil.str(body, "category"),
                copies, copies);
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "ADD_BOOK", "library_books", id, ApiUtil.str(body, "title"));
        return ResponseEntity.ok(getById("library_books", id));
    }

    @GetMapping("/library-books")
    List<Map<String, Object>> listBooks(@RequestParam UUID schoolId) {
        return jdbc.queryForList("SELECT * FROM library_books WHERE school_id = ? ORDER BY title", schoolId);
    }

    @PostMapping("/library-issues")
    ResponseEntity<Map<String, Object>> issueBook(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID bookId = ApiUtil.uuid(body, "bookId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO library_issues (school_id, book_id, student_id, issued_on, due_date, status)
                VALUES (?, ?, ?, ?, ?, 'ISSUED')
                RETURNING id
                """, UUID.class, schoolId, bookId,
                ApiUtil.uuid(body, "studentId"),
                LocalDate.now(),
                LocalDate.parse(ApiUtil.required(body, "dueDate")));
        jdbc.update("UPDATE library_books SET copies_available = copies_available - 1 WHERE id = ? AND copies_available > 0", bookId);
        ApiUtil.audit(jdbc, schoolId, ApiUtil.str(body, "actorEmail"), "ISSUE_BOOK", "library_issues", id, bookId.toString());
        return ResponseEntity.ok(getById("library_issues", id));
    }

    @PostMapping("/library-issues/{id}/return")
    ResponseEntity<Map<String, Object>> returnBook(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        Map<String, Object> issue = getById("library_issues", id);
        jdbc.update("UPDATE library_issues SET returned_on = CURRENT_DATE, status = 'RETURNED' WHERE id = ?", id);
        jdbc.update("UPDATE library_books SET copies_available = copies_available + 1 WHERE id = ?", issue.get("book_id"));
        return ResponseEntity.ok(getById("library_issues", id));
    }

    @GetMapping("/library-issues")
    List<Map<String, Object>> listIssues(@RequestParam UUID schoolId) {
        return jdbc.queryForList("""
                SELECT li.*, lb.title, lb.author, s.first_name, s.last_name, s.admission_no
                FROM library_issues li
                JOIN library_books lb ON lb.id = li.book_id
                LEFT JOIN students s ON s.id = li.student_id
                WHERE li.school_id = ?
                ORDER BY li.issued_on DESC
                """, schoolId);
    }

    // ── Hostel ────────────────────────────────────────────────────────────────

    @PostMapping("/hostel-rooms")
    ResponseEntity<Map<String, Object>> createRoom(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO hostel_rooms (school_id, room_number, block, capacity, gender)
                VALUES (?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, schoolId,
                ApiUtil.required(body, "roomNumber"),
                ApiUtil.str(body, "block"),
                intVal(body.get("capacity"), 4),
                ApiUtil.str(body, "gender"));
        return ResponseEntity.ok(getById("hostel_rooms", id));
    }

    @GetMapping("/hostel-rooms")
    List<Map<String, Object>> listRooms(@RequestParam UUID schoolId) {
        return jdbc.queryForList("""
                SELECT r.*, COUNT(a.id) AS occupied
                FROM hostel_rooms r
                LEFT JOIN hostel_allocations a ON a.room_id = r.id AND a.check_out IS NULL
                WHERE r.school_id = ?
                GROUP BY r.id ORDER BY r.room_number
                """, schoolId);
    }

    @PostMapping("/hostel-allocations")
    ResponseEntity<Map<String, Object>> allocateRoom(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO hostel_allocations (school_id, room_id, student_id, academic_year, check_in)
                VALUES (?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, schoolId,
                ApiUtil.uuid(body, "roomId"),
                ApiUtil.uuid(body, "studentId"),
                intVal(body.get("academicYear"), LocalDate.now().getYear()),
                LocalDate.now());
        return ResponseEntity.ok(getById("hostel_allocations", id));
    }

    @GetMapping("/hostel-allocations")
    List<Map<String, Object>> listAllocations(@RequestParam UUID schoolId) {
        return jdbc.queryForList("""
                SELECT ha.*, s.first_name, s.last_name, s.admission_no, r.room_number, r.block
                FROM hostel_allocations ha
                JOIN students s ON s.id = ha.student_id
                JOIN hostel_rooms r ON r.id = ha.room_id
                WHERE ha.school_id = ?
                ORDER BY ha.check_in DESC
                """, schoolId);
    }

    // ── Events / Calendar ─────────────────────────────────────────────────────

    @PostMapping("/events")
    ResponseEntity<Map<String, Object>> createEvent(@RequestBody Map<String, Object> body) {
        UUID schoolId = ApiUtil.uuid(body, "schoolId");
        UUID id = jdbc.queryForObject("""
                INSERT INTO events (school_id, title, description, event_date, end_date, category)
                VALUES (?, ?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, schoolId,
                ApiUtil.required(body, "title"),
                ApiUtil.str(body, "description"),
                LocalDate.parse(ApiUtil.required(body, "eventDate")),
                body.get("endDate") != null ? LocalDate.parse(body.get("endDate").toString()) : null,
                body.getOrDefault("category", "GENERAL").toString());
        return ResponseEntity.ok(getById("events", id));
    }

    @GetMapping("/events")
    List<Map<String, Object>> listEvents(@RequestParam UUID schoolId) {
        return jdbc.queryForList("SELECT * FROM events WHERE school_id = ? ORDER BY event_date", schoolId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Map<String, Object> getById(String table, UUID id) {
        return jdbc.queryForMap("SELECT * FROM " + table + " WHERE id = ?", id);
    }

    private int intVal(Object v, int fallback) {
        return v == null || v.toString().isBlank() ? fallback : Integer.parseInt(v.toString());
    }

    private BigDecimal money(Object v) {
        if (v == null || v.toString().isBlank()) throw new IllegalArgumentException("amount is required");
        return new BigDecimal(v.toString());
    }

    private String computeGrade(double score) {
        if (score >= 80) return "A";
        if (score >= 75) return "A-";
        if (score >= 70) return "B+";
        if (score >= 65) return "B";
        if (score >= 60) return "B-";
        if (score >= 55) return "C+";
        if (score >= 50) return "C";
        if (score >= 45) return "C-";
        if (score >= 40) return "D+";
        if (score >= 35) return "D";
        return "E";
    }
}
