"use client";

import { useRouter } from "next/navigation";
import {
  BookOpen, BookMarked, Building2, CalendarDays, ChevronDown, ChevronsLeft,
  ClipboardCheck, GraduationCap, Home, LogOut, Menu, MessageSquareText,
  Package, Plus, ReceiptText, UserCog, UsersRound, X, Bed, Calendar,
} from "lucide-react";
import { ComponentType, FormEvent, useEffect, useMemo, useState } from "react";
import { clearSession, readApiSession, readSession, SchoolProfile } from "@/lib/curio-session";

// ─── API base ─────────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);
  return data as T;
}

function get<T>(path: string) { return api<T>(path); }
function post<T>(path: string, body: unknown) {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;

type AllData = {
  // dashboard
  metrics: Record<string, number>;
  recentPayments: Row[];
  applications: Row[];
  alerts: Row[];
  classHealth: Row[];
  // lists
  students: Row[];
  parents: Row[];
  teachers: Row[];
  classes: Row[];
  invoices: Row[];
  subjects: Row[];
  exams: Row[];
  results: Row[];
  feeStructures: Row[];
  expenses: Row[];
  timetable: Row[];
  discipline: Row[];
  leaveRequests: Row[];
  assets: Row[];
  libraryBooks: Row[];
  libraryIssues: Row[];
  hostelRooms: Row[];
  hostelAllocations: Row[];
  events: Row[];
};

const emptyData: AllData = {
  metrics: {}, recentPayments: [], applications: [], alerts: [], classHealth: [],
  students: [], parents: [], teachers: [], classes: [], invoices: [],
  subjects: [], exams: [], results: [], feeStructures: [], expenses: [],
  timetable: [], discipline: [], leaveRequests: [], assets: [],
  libraryBooks: [], libraryIssues: [], hostelRooms: [], hostelAllocations: [], events: [],
};

// ─── Nav ──────────────────────────────────────────────────────────────────────
type NavItem = { label: string; section: string };
type NavGroup = { label: string; icon: ComponentType<{ size?: number }>; items: NavItem[] };

const NAV: NavGroup[] = [
  { label: "Dashboard",      icon: Home,             items: [{ label: "Overview", section: "overview" }, { label: "Daily Operations", section: "operations" }] },
  { label: "Admissions",     icon: ClipboardCheck,   items: [{ label: "Applications", section: "applications" }] },
  { label: "Students",       icon: GraduationCap,    items: [{ label: "Registry", section: "students" }, { label: "Parents", section: "parents" }, { label: "Discipline", section: "discipline" }] },
  { label: "Academics",      icon: BookOpen,         items: [{ label: "Classes", section: "classes" }, { label: "Subjects", section: "subjects" }, { label: "Timetable", section: "timetable" }, { label: "Exams", section: "exams" }, { label: "Results", section: "results" }] },
  { label: "Attendance",     icon: CalendarDays,     items: [{ label: "Daily Roll Call", section: "attendance" }] },
  { label: "Finance",        icon: ReceiptText,      items: [{ label: "Fee Structures", section: "fee-structures" }, { label: "Invoices", section: "invoices" }, { label: "Payments", section: "payments" }, { label: "Expenses", section: "expenses" }, { label: "Summary", section: "finance-summary" }] },
  { label: "Staff",          icon: UserCog,          items: [{ label: "Teachers", section: "teachers" }, { label: "Leave Requests", section: "leave-requests" }] },
  { label: "Library",        icon: BookMarked,       items: [{ label: "Books", section: "library-books" }, { label: "Issues", section: "library-issues" }] },
  { label: "Assets",         icon: Package,          items: [{ label: "Asset Register", section: "assets" }] },
  { label: "Hostel",         icon: Bed,              items: [{ label: "Rooms", section: "hostel-rooms" }, { label: "Allocations", section: "hostel-allocations" }] },
  { label: "Communication",  icon: MessageSquareText,items: [{ label: "Notices", section: "notices" }] },
  { label: "Calendar",       icon: Calendar,         items: [{ label: "Events", section: "events" }] },
  { label: "Administration", icon: Building2,        items: [{ label: "School Settings", section: "settings" }] },
];

// ─── Form configs ─────────────────────────────────────────────────────────────
type FieldDef = { key: string; label: string; type?: string; options?: string[]; required?: boolean };
type FormConfig = { title: string; endpoint: string; fields: FieldDef[] };

const FORMS: Record<string, FormConfig> = {
  students: { title: "Add Student", endpoint: "/api/students", fields: [
    { key: "admissionNo", label: "Admission No.", required: true },
    { key: "firstName",   label: "First Name",    required: true },
    { key: "lastName",    label: "Last Name",      required: true },
    { key: "gender",      label: "Gender",         type: "select", options: ["Male","Female","Other"] },
    { key: "dateOfBirth", label: "Date of Birth",  type: "date" },
    { key: "parentId",    label: "Parent",         type: "parent-select" },
    { key: "classId",     label: "Class",          type: "class-select" },
  ]},
  parents: { title: "Add Parent", endpoint: "/api/parents", fields: [
    { key: "fullName",     label: "Full Name",   required: true },
    { key: "phone",        label: "Phone" },
    { key: "email",        label: "Email",       type: "email" },
    { key: "relationship", label: "Relationship", type: "select", options: ["Mother","Father","Guardian","Sibling","Other"] },
    { key: "address",      label: "Address",      type: "textarea" },
  ]},
  teachers: { title: "Add Teacher", endpoint: "/api/teachers", fields: [
    { key: "fullName",       label: "Full Name",       required: true },
    { key: "phone",          label: "Phone" },
    { key: "email",          label: "Email",           type: "email" },
    { key: "department",     label: "Department" },
    { key: "employmentType", label: "Employment Type", type: "select", options: ["Full-Time","Part-Time","Contract","Volunteer"] },
  ]},
  classes: { title: "Add Class", endpoint: "/api/classes", fields: [
    { key: "name",         label: "Class Name",    required: true },
    { key: "level",        label: "Level" },
    { key: "academicYear", label: "Academic Year", type: "number" },
  ]},
  subjects: { title: "Add Subject", endpoint: "/api/subjects", fields: [
    { key: "name",      label: "Subject Name", required: true },
    { key: "code",      label: "Code" },
    { key: "classId",   label: "Class",         type: "class-select" },
    { key: "teacherId", label: "Teacher",       type: "teacher-select" },
  ]},
  timetable: { title: "Add Timetable Slot", endpoint: "/api/timetable", fields: [
    { key: "classId",    label: "Class",       type: "class-select",   required: true },
    { key: "subjectId",  label: "Subject",     type: "subject-select" },
    { key: "teacherId",  label: "Teacher",     type: "teacher-select" },
    { key: "dayOfWeek",  label: "Day",         type: "select", options: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] },
    { key: "startTime",  label: "Start Time",  type: "time" },
    { key: "endTime",    label: "End Time",    type: "time" },
    { key: "room",       label: "Room" },
  ]},
  exams: { title: "Add Exam", endpoint: "/api/exams", fields: [
    { key: "name",         label: "Exam Name",    required: true },
    { key: "term",         label: "Term",         type: "select", options: ["Term 1","Term 2","Term 3","Semester 1","Semester 2"] },
    { key: "academicYear", label: "Academic Year", type: "number" },
    { key: "startsOn",     label: "Starts On",    type: "date" },
  ]},
  results: { title: "Add Result", endpoint: "/api/results", fields: [
    { key: "examId",     label: "Exam",    type: "exam-select",    required: true },
    { key: "studentId",  label: "Student", type: "student-select", required: true },
    { key: "subject",    label: "Subject", required: true },
    { key: "score",      label: "Score (0–100)", type: "number" },
  ]},
  applications: { title: "Add Application", endpoint: "/api/applications", fields: [
    { key: "applicantName",  label: "Applicant Name", required: true },
    { key: "targetClass",    label: "Target Class" },
    { key: "guardianName",   label: "Guardian Name" },
    { key: "guardianPhone",  label: "Guardian Phone" },
    { key: "status",         label: "Status", type: "select", options: ["REVIEW","APPROVED","REJECTED"] },
  ]},
  "fee-structures": { title: "Add Fee Structure", endpoint: "/api/fee-structures", fields: [
    { key: "name",         label: "Fee Name",     required: true },
    { key: "amount",       label: "Amount (KSh)", type: "number", required: true },
    { key: "classId",      label: "Class (optional)", type: "class-select" },
    { key: "term",         label: "Term", type: "select", options: ["Term 1","Term 2","Term 3","Full Year"] },
    { key: "academicYear", label: "Academic Year", type: "number" },
    { key: "description",  label: "Description", type: "textarea" },
  ]},
  invoices: { title: "Add Invoice", endpoint: "/api/invoices", fields: [
    { key: "invoiceNo",  label: "Invoice No.",   required: true },
    { key: "studentId",  label: "Student",       type: "student-select", required: true },
    { key: "description",label: "Description",   type: "textarea" },
    { key: "amount",     label: "Amount (KSh)",  type: "number", required: true },
    { key: "dueDate",    label: "Due Date",       type: "date" },
  ]},
  payments: { title: "Record Payment", endpoint: "/api/payments", fields: [
    { key: "invoiceId",  label: "Invoice",  type: "invoice-select", required: true },
    { key: "studentId",  label: "Student",  type: "student-select", required: true },
    { key: "amount",     label: "Amount (KSh)", type: "number", required: true },
    { key: "channel",    label: "Channel",  type: "select", options: ["M-PESA","Cash","Bank Transfer","Card","Cheque"] },
    { key: "reference",  label: "Reference / Receipt No." },
  ]},
  expenses: { title: "Add Expense", endpoint: "/api/expenses", fields: [
    { key: "category",     label: "Category", type: "select", options: ["Salaries","Utilities","Maintenance","Stationery","Transport","Events","Other"] },
    { key: "description",  label: "Description", type: "textarea" },
    { key: "amount",       label: "Amount (KSh)", type: "number", required: true },
    { key: "paidTo",       label: "Paid To" },
    { key: "paymentDate",  label: "Payment Date", type: "date" },
    { key: "approvedBy",   label: "Approved By" },
  ]},
  attendance: { title: "Mark Attendance", endpoint: "/api/attendance", fields: [
    { key: "studentId",      label: "Student",        type: "student-select", required: true },
    { key: "attendanceDate", label: "Date",           type: "date" },
    { key: "status",         label: "Status",         type: "select", options: ["PRESENT","ABSENT","LATE","EXCUSED"] },
    { key: "notes",          label: "Notes",          type: "textarea" },
  ]},
  discipline: { title: "Log Incident", endpoint: "/api/discipline", fields: [
    { key: "studentId",    label: "Student",       type: "student-select", required: true },
    { key: "category",     label: "Category",      type: "select", options: ["Bullying","Lateness","Absenteeism","Vandalism","Misconduct","Other"] },
    { key: "severity",     label: "Severity",      type: "select", options: ["LOW","MEDIUM","HIGH"] },
    { key: "incidentDate", label: "Incident Date", type: "date" },
    { key: "description",  label: "Description",   type: "textarea" },
    { key: "actionTaken",  label: "Action Taken",  type: "textarea" },
  ]},
  "leave-requests": { title: "Submit Leave Request", endpoint: "/api/leave-requests", fields: [
    { key: "teacherId",  label: "Teacher",    type: "teacher-select", required: true },
    { key: "leaveType",  label: "Leave Type", type: "select", options: ["Annual","Sick","Maternity","Paternity","Casual","Emergency"] },
    { key: "startDate",  label: "Start Date", type: "date", required: true },
    { key: "endDate",    label: "End Date",   type: "date", required: true },
    { key: "reason",     label: "Reason",     type: "textarea" },
  ]},
  assets: { title: "Add Asset", endpoint: "/api/assets", fields: [
    { key: "name",          label: "Asset Name",   required: true },
    { key: "category",      label: "Category",     type: "select", options: ["Furniture","Electronics","Vehicles","Lab Equipment","Sports","Kitchen","Other"] },
    { key: "serialNo",      label: "Serial No." },
    { key: "purchaseDate",  label: "Purchase Date", type: "date" },
    { key: "purchaseValue", label: "Purchase Value (KSh)", type: "number" },
    { key: "condition",     label: "Condition",    type: "select", options: ["NEW","GOOD","FAIR","POOR","CONDEMNED"] },
    { key: "location",      label: "Location" },
  ]},
  "library-books": { title: "Add Book", endpoint: "/api/library-books", fields: [
    { key: "title",       label: "Title",    required: true },
    { key: "author",      label: "Author" },
    { key: "isbn",        label: "ISBN" },
    { key: "category",    label: "Category", type: "select", options: ["Textbook","Novel","Reference","Science","History","Art","Other"] },
    { key: "copiesTotal", label: "No. of Copies", type: "number" },
  ]},
  "library-issues": { title: "Issue Book", endpoint: "/api/library-issues", fields: [
    { key: "bookId",    label: "Book",    type: "book-select",    required: true },
    { key: "studentId", label: "Student", type: "student-select", required: true },
    { key: "dueDate",   label: "Due Date", type: "date",          required: true },
  ]},
  "hostel-rooms": { title: "Add Room", endpoint: "/api/hostel-rooms", fields: [
    { key: "roomNumber", label: "Room Number", required: true },
    { key: "block",      label: "Block / Wing" },
    { key: "capacity",   label: "Capacity",    type: "number" },
    { key: "gender",     label: "Gender",      type: "select", options: ["Male","Female","Mixed"] },
  ]},
  "hostel-allocations": { title: "Allocate Student to Room", endpoint: "/api/hostel-allocations", fields: [
    { key: "roomId",       label: "Room",          type: "room-select",    required: true },
    { key: "studentId",    label: "Student",       type: "student-select", required: true },
    { key: "academicYear", label: "Academic Year", type: "number" },
  ]},
  notices: { title: "Send Notice", endpoint: "/api/notifications", fields: [
    { key: "channel",   label: "Channel",   type: "select", options: ["SMS","EMAIL","INTERNAL"], required: true },
    { key: "recipient", label: "Recipient (phone / email)" },
    { key: "subject",   label: "Subject" },
    { key: "message",   label: "Message",   type: "textarea", required: true },
  ]},
  events: { title: "Add Event", endpoint: "/api/events", fields: [
    { key: "title",       label: "Event Title",  required: true },
    { key: "category",    label: "Category",     type: "select", options: ["ACADEMIC","SPORTS","CULTURAL","HOLIDAY","EXAM","GENERAL"] },
    { key: "eventDate",   label: "Event Date",   type: "date", required: true },
    { key: "endDate",     label: "End Date",     type: "date" },
    { key: "description", label: "Description",  type: "textarea" },
  ]},
};

// Section → form key mapping
const SECTION_FORM: Record<string, string> = {
  students: "students", parents: "parents", teachers: "teachers",
  classes: "classes", subjects: "subjects", timetable: "timetable",
  exams: "exams", results: "results", applications: "applications",
  "fee-structures": "fee-structures", invoices: "invoices",
  payments: "payments", expenses: "expenses", attendance: "attendance",
  discipline: "discipline", "leave-requests": "leave-requests",
  assets: "assets", "library-books": "library-books",
  "library-issues": "library-issues", "hostel-rooms": "hostel-rooms",
  "hostel-allocations": "hostel-allocations", notices: "notices", events: "events",
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [actorEmail, setActorEmail] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [openGroup, setOpenGroup] = useState("Dashboard");
  const [section, setSection] = useState("overview");
  const [data, setData] = useState<AllData>(emptyData);
  const [loadError, setLoadError] = useState("");
  const [modalKey, setModalKey] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formMsg, setFormMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!readSession()) { router.replace("/login"); return; }
    const session = readApiSession();
    if (!session?.school.id) { router.replace("/login"); return; }
    setProfile(session.school);
    setActorEmail(session.user.email);
  }, [mounted, router]);

  useEffect(() => {
    if (profile?.id) void loadAll(profile.id);
  }, [profile?.id]);

  const today = useMemo(() =>
    new Intl.DateTimeFormat("en-KE", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date()), []);

  async function loadAll(sid: string) {
    try {
      const [dash, students, parents, teachers, classes, invoices,
             subjects, exams, results, feeStructures, expenses,
             timetable, discipline, leaveRequests, assets,
             libraryBooks, libraryIssues, hostelRooms, hostelAllocations, events] = await Promise.all([
        get<Record<string,unknown>>(`/api/dashboard?schoolId=${sid}`),
        get<Row[]>(`/api/students?schoolId=${sid}`),
        get<Row[]>(`/api/parents?schoolId=${sid}`),
        get<Row[]>(`/api/teachers?schoolId=${sid}`),
        get<Row[]>(`/api/classes?schoolId=${sid}`),
        get<Row[]>(`/api/invoices?schoolId=${sid}`),
        get<Row[]>(`/api/subjects?schoolId=${sid}`),
        get<Row[]>(`/api/exams?schoolId=${sid}`),
        get<Row[]>(`/api/results?schoolId=${sid}`),
        get<Row[]>(`/api/fee-structures?schoolId=${sid}`),
        get<Row[]>(`/api/expenses?schoolId=${sid}`),
        get<Row[]>(`/api/timetable?schoolId=${sid}`),
        get<Row[]>(`/api/discipline?schoolId=${sid}`),
        get<Row[]>(`/api/leave-requests?schoolId=${sid}`),
        get<Row[]>(`/api/assets?schoolId=${sid}`),
        get<Row[]>(`/api/library-books?schoolId=${sid}`),
        get<Row[]>(`/api/library-issues?schoolId=${sid}`),
        get<Row[]>(`/api/hostel-rooms?schoolId=${sid}`),
        get<Row[]>(`/api/hostel-allocations?schoolId=${sid}`),
        get<Row[]>(`/api/events?schoolId=${sid}`),
      ]);
      const d = dash as Record<string, unknown>;
      setData({
        metrics: (d.metrics || {}) as Record<string, number>,
        recentPayments: (d.recentPayments || []) as Row[],
        applications: (d.applications || []) as Row[],
        alerts: (d.alerts || []) as Row[],
        classHealth: (d.classHealth || []) as Row[],
        students, parents, teachers, classes, invoices,
        subjects, exams, results, feeStructures, expenses,
        timetable, discipline, leaveRequests, assets,
        libraryBooks, libraryIssues, hostelRooms, hostelAllocations, events,
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Backend unreachable.");
    }
  }

  function openModal(key: string) { setModalKey(key); setForm({}); setFormMsg(""); }
  function closeModal() { setModalKey(null); setForm({}); setFormMsg(""); }
  function setField(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    if (!modalKey || !profile?.id) return;
    const config = FORMS[modalKey];
    if (!config) return;
    setSaving(true);
    try {
      await post(config.endpoint, { ...form, schoolId: profile.id, actorEmail });
      setFormMsg("Saved successfully.");
      await loadAll(profile.id);
      setTimeout(closeModal, 700);
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : "Save failed.");
    } finally { setSaving(false); }
  }

  async function approveLeave(id: string, status: string) {
    await post(`/api/leave-requests/${id}/approve`, { status });
    if (profile?.id) await loadAll(profile.id);
  }

  async function returnBook(id: string) {
    await post(`/api/library-issues/${id}/return`, {});
    if (profile?.id) await loadAll(profile.id);
  }

  async function generateInvoices(feeId: string) {
    if (!profile?.id) return;
    const dueDate = prompt("Due date for these invoices? (YYYY-MM-DD)");
    if (!dueDate) return;
    const res = await post<{generated: number}>(`/api/fee-structures/${feeId}/generate-invoices`, {
      schoolId: profile.id, actorEmail, dueDate,
    });
    alert(`${res.generated} invoices generated.`);
    await loadAll(profile.id);
  }

  if (!mounted || !profile) {
    return (
      <main className="loading-screen">
        {loadError
          ? <div style={{textAlign:"center"}}><p style={{color:"#ef4444"}}>{loadError}</p><button onClick={() => window.location.reload()}>Retry</button></div>
          : "Loading CURIO…"}
      </main>
    );
  }

  const m = data.metrics;
  const formConfig = modalKey ? FORMS[modalKey] : null;

  return (
    <main className={`dashboard-shell${collapsed ? " is-collapsed" : ""}`}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <a className="side-brand" href="/dashboard">
            {profile.logo
              ? <img className="school-logo" src={profile.logo} alt="" />
              : <span className="fallback-logo">{profile.schoolName.charAt(0)}</span>}
            <span className="brand-copy">
              <strong>{profile.schoolName}</strong>
              <span>{profile.schoolType}</span>
            </span>
          </a>
          <button className="collapse-button" type="button" onClick={() => setCollapsed(v => !v)}>
            {collapsed ? <Menu size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>

        <nav className="nav-list">
          {NAV.map(group => {
            const Icon = group.icon;
            const open = openGroup === group.label;
            return (
              <section className="nav-group" key={group.label}>
                <button className={`nav-trigger${open ? " active" : ""}`} type="button"
                  title={collapsed ? group.label : undefined}
                  onClick={() => setOpenGroup(open ? "" : group.label)}>
                  <Icon size={18} /><span>{group.label}</span>
                  <ChevronDown className="nav-chevron" size={15} />
                </button>
                {!collapsed && open && (
                  <div className="nav-submenu">
                    {group.items.map(item => (
                      <button key={item.section}
                        className={`nav-sub-item${section === item.section ? " active" : ""}`}
                        type="button"
                        onClick={() => setSection(item.section)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-trigger" type="button" onClick={() => { clearSession(); router.push("/login"); }}>
            <LogOut size={18} /><span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Workspace ───────────────────────────────────────────────────── */}
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="topbar-school">{profile.schoolName}</p>
            <p className="topbar-date">{today}</p>
          </div>
          {SECTION_FORM[section] && (
            <button className="add-btn" type="button" onClick={() => openModal(SECTION_FORM[section])}>
              <Plus size={15} /> {FORMS[SECTION_FORM[section]]?.title}
            </button>
          )}
        </header>

        {/* ── Overview ──────────────────────────────────────────────────── */}
        {section === "overview" && (
          <div className="section-body">
            <div className="metrics-row">
              {[
                { label: "Students",     value: m.students     || 0, go: "students" },
                { label: "Teachers",     value: m.teachers     || 0, go: "teachers" },
                { label: "Parents",      value: m.parents      || 0, go: "parents"  },
                { label: "Classes",      value: m.classes      || 0, go: "classes"  },
                { label: "Applications", value: m.openApplications || 0, go: "applications" },
                { label: "Present Today",value: m.presentToday || 0, go: "attendance" },
                { label: "Paid Today",   value: `KSh ${Number(m.paymentsToday || 0).toLocaleString("en-KE")}`, go: "payments" },
                { label: "Outstanding",  value: `KSh ${Number(m.outstandingBalance || 0).toLocaleString("en-KE")}`, go: "invoices" },
              ].map(s => (
                <article key={s.label} className="stat-card clickable" onClick={() => setSection(s.go)}>
                  <span className="stat-label">{s.label}</span>
                  <strong className="stat-value">{String(s.value)}</strong>
                </article>
              ))}
            </div>
            <div className="two-col">
              <div className="panel">
                <h3 className="panel-title">Recent Payments</h3>
                <T rows={data.recentPayments} cols={["first_name","last_name","amount","channel","paid_at"]} empty="No payments yet." />
              </div>
              <div className="panel">
                <h3 className="panel-title">Applications</h3>
                <T rows={data.applications} cols={["applicant_name","target_class","status","created_at"]} empty="No applications yet." />
              </div>
            </div>
            <div className="two-col">
              <div className="panel">
                <h3 className="panel-title">Class Sizes</h3>
                {data.classHealth.length === 0 ? <p className="empty-state">No classes yet.</p>
                  : data.classHealth.map(c => (
                    <div className="bar-row" key={String(c.id)}>
                      <span className="bar-label">{String(c.name)}</span>
                      <div className="bar-track"><span style={{ width: `${Math.min(Number(c.students) * 5, 100)}%` }} /></div>
                      <span className="bar-count">{String(c.students)}</span>
                    </div>
                  ))}
              </div>
              <div className="panel">
                <h3 className="panel-title">Upcoming Events</h3>
                <T rows={data.events.slice(0,5)} cols={["title","category","event_date"]} empty="No events yet." />
              </div>
            </div>
          </div>
        )}

        {/* ── Daily Operations ──────────────────────────────────────────── */}
        {section === "operations" && (
          <div className="section-body">
            <h2 className="section-heading">Quick Actions</h2>
            <div className="action-grid">
              {Object.entries(FORMS).map(([key, cfg]) => (
                <button key={key} className="action-tile" type="button" onClick={() => openModal(key)}>
                  <Plus size={18} /><span>{cfg.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Simple list sections ───────────────────────────────────────── */}
        {section === "applications" && <ListSection title="Applications" rows={data.applications} cols={["applicant_name","target_class","guardian_name","guardian_phone","status","created_at"]} onAdd={() => openModal("applications")} />}
        {section === "students"     && <ListSection title="Students"     rows={data.students}     cols={["admission_no","first_name","last_name","gender","class_name","parent_name","status"]} onAdd={() => openModal("students")} />}
        {section === "parents"      && <ListSection title="Parents"      rows={data.parents}      cols={["full_name","phone","email","relationship"]} onAdd={() => openModal("parents")} />}
        {section === "teachers"     && <ListSection title="Teachers"     rows={data.teachers}     cols={["full_name","phone","email","department","employment_type","status"]} onAdd={() => openModal("teachers")} />}
        {section === "classes"      && <ListSection title="Classes"      rows={data.classes}      cols={["name","level","academic_year"]} onAdd={() => openModal("classes")} />}
        {section === "subjects"     && <ListSection title="Subjects"     rows={data.subjects}     cols={["name","code","class_name","teacher_name"]} onAdd={() => openModal("subjects")} />}
        {section === "timetable"    && <ListSection title="Timetable"    rows={data.timetable}    cols={["class_name","subject_name","teacher_name","day_of_week","start_time","end_time","room"]} onAdd={() => openModal("timetable")} />}
        {section === "exams"        && <ListSection title="Exams"        rows={data.exams}        cols={["name","term","academic_year","starts_on"]} onAdd={() => openModal("exams")} />}
        {section === "results"      && <ListSection title="Results"      rows={data.results}      cols={["first_name","last_name","admission_no","exam_name","subject","score","grade"]} onAdd={() => openModal("results")} />}
        {section === "invoices"     && <ListSection title="Invoices"     rows={data.invoices}     cols={["invoice_no","description","amount","balance","status","due_date"]} onAdd={() => openModal("invoices")} />}
        {section === "payments"     && <ListSection title="Payments"     rows={data.recentPayments} cols={["first_name","last_name","invoice_no","amount","channel","reference","paid_at"]} onAdd={() => openModal("payments")} />}
        {section === "expenses"     && <ListSection title="Expenses"     rows={data.expenses}     cols={["category","description","amount","paid_to","payment_date","approved_by"]} onAdd={() => openModal("expenses")} />}
        {section === "attendance"   && <ListSection title="Attendance"   rows={[]}                cols={[]} onAdd={() => openModal("attendance")} emptyMsg="Use the Add button to mark daily attendance." />}
        {section === "discipline"   && <ListSection title="Discipline Incidents" rows={data.discipline} cols={["first_name","last_name","category","severity","incident_date","action_taken"]} onAdd={() => openModal("discipline")} />}
        {section === "assets"       && <ListSection title="Asset Register" rows={data.assets}     cols={["name","category","serial_no","condition","location","purchase_value"]} onAdd={() => openModal("assets")} />}
        {section === "notices"      && <ListSection title="Notices"      rows={data.alerts}       cols={["channel","recipient","subject","status","created_at"]} onAdd={() => openModal("notices")} />}
        {section === "events"       && <ListSection title="Events"       rows={data.events}       cols={["title","category","event_date","end_date"]} onAdd={() => openModal("events")} />}

        {/* ── Fee Structures ────────────────────────────────────────────── */}
        {section === "fee-structures" && (
          <div className="section-body">
            <div className="section-header">
              <div><h2 className="section-heading">Fee Structures</h2><span className="section-count">{data.feeStructures.length} records</span></div>
              <button className="add-btn" type="button" onClick={() => openModal("fee-structures")}><Plus size={15} /> Add Fee Structure</button>
            </div>
            <div className="panel">
              {data.feeStructures.length === 0 ? <p className="empty-state">No fee structures yet.</p> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Name</th><th>Class</th><th>Term</th><th>Amount</th><th>Action</th></tr></thead>
                    <tbody>
                      {data.feeStructures.map(f => (
                        <tr key={String(f.id)}>
                          <td>{String(f.name)}</td>
                          <td>{f.class_name ? String(f.class_name) : "All Classes"}</td>
                          <td>{f.term ? String(f.term) : "—"}</td>
                          <td>KSh {Number(f.amount).toLocaleString("en-KE")}</td>
                          <td>
                            <button className="inline-btn" type="button" onClick={() => generateInvoices(String(f.id))}>
                              Generate Invoices
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Finance Summary ───────────────────────────────────────────── */}
        {section === "finance-summary" && (
          <FinanceSummary schoolId={profile.id!} />
        )}

        {/* ── Leave Requests ────────────────────────────────────────────── */}
        {section === "leave-requests" && (
          <div className="section-body">
            <div className="section-header">
              <div><h2 className="section-heading">Leave Requests</h2><span className="section-count">{data.leaveRequests.length} records</span></div>
              <button className="add-btn" type="button" onClick={() => openModal("leave-requests")}><Plus size={15} /> Submit Leave</button>
            </div>
            <div className="panel">
              {data.leaveRequests.length === 0 ? <p className="empty-state">No leave requests.</p> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Teacher</th><th>Type</th><th>Start</th><th>End</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {data.leaveRequests.map(l => (
                        <tr key={String(l.id)}>
                          <td>{String(l.teacher_name || "—")}</td>
                          <td>{String(l.leave_type)}</td>
                          <td>{fmt(l.start_date)}</td>
                          <td>{fmt(l.end_date)}</td>
                          <td>{String(l.reason || "—").slice(0,40)}</td>
                          <td><span className={`badge ${String(l.status).toLowerCase()}`}>{String(l.status)}</span></td>
                          <td>
                            {l.status === "PENDING" && (
                              <div style={{display:"flex",gap:4}}>
                                <button className="inline-btn green" type="button" onClick={() => approveLeave(String(l.id), "APPROVED")}>Approve</button>
                                <button className="inline-btn red"   type="button" onClick={() => approveLeave(String(l.id), "REJECTED")}>Reject</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Library Books ─────────────────────────────────────────────── */}
        {section === "library-books" && (
          <div className="section-body">
            <div className="section-header">
              <div><h2 className="section-heading">Library Books</h2><span className="section-count">{data.libraryBooks.length} titles</span></div>
              <button className="add-btn" type="button" onClick={() => openModal("library-books")}><Plus size={15} /> Add Book</button>
            </div>
            <div className="panel">
              {data.libraryBooks.length === 0 ? <p className="empty-state">No books catalogued yet.</p> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Title</th><th>Author</th><th>ISBN</th><th>Category</th><th>Total</th><th>Available</th><th>Action</th></tr></thead>
                    <tbody>
                      {data.libraryBooks.map(b => (
                        <tr key={String(b.id)}>
                          <td>{String(b.title)}</td>
                          <td>{String(b.author || "—")}</td>
                          <td>{String(b.isbn || "—")}</td>
                          <td>{String(b.category || "—")}</td>
                          <td>{String(b.copies_total)}</td>
                          <td>{String(b.copies_available)}</td>
                          <td>
                            {Number(b.copies_available) > 0 && (
                              <button className="inline-btn" type="button"
                                onClick={() => { openModal("library-issues"); setField("bookId", String(b.id)); }}>
                                Issue
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Library Issues ────────────────────────────────────────────── */}
        {section === "library-issues" && (
          <div className="section-body">
            <div className="section-header">
              <div><h2 className="section-heading">Book Issues</h2><span className="section-count">{data.libraryIssues.length} records</span></div>
              <button className="add-btn" type="button" onClick={() => openModal("library-issues")}><Plus size={15} /> Issue Book</button>
            </div>
            <div className="panel">
              {data.libraryIssues.length === 0 ? <p className="empty-state">No issues yet.</p> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Book</th><th>Student</th><th>Issued</th><th>Due</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {data.libraryIssues.map(i => (
                        <tr key={String(i.id)}>
                          <td>{String(i.title)}</td>
                          <td>{String(i.first_name)} {String(i.last_name)}</td>
                          <td>{fmt(i.issued_on)}</td>
                          <td>{fmt(i.due_date)}</td>
                          <td><span className={`badge ${String(i.status).toLowerCase()}`}>{String(i.status)}</span></td>
                          <td>
                            {i.status === "ISSUED" && (
                              <button className="inline-btn" type="button" onClick={() => returnBook(String(i.id))}>Return</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Hostel Rooms ──────────────────────────────────────────────── */}
        {section === "hostel-rooms" && (
          <ListSection title="Hostel Rooms" rows={data.hostelRooms} cols={["room_number","block","capacity","gender","occupied"]} onAdd={() => openModal("hostel-rooms")} />
        )}

        {/* ── Hostel Allocations ────────────────────────────────────────── */}
        {section === "hostel-allocations" && (
          <ListSection title="Room Allocations" rows={data.hostelAllocations} cols={["first_name","last_name","admission_no","room_number","block","check_in","academic_year"]} onAdd={() => openModal("hostel-allocations")} />
        )}

        {/* ── Settings ──────────────────────────────────────────────────── */}
        {section === "settings" && (
          <div className="section-body">
            <h2 className="section-heading">School Settings</h2>
            <div className="panel">
              <table><tbody>
                {[["School Name", profile.schoolName], ["Email", profile.email], ["Phone", profile.phone || "—"],
                  ["Country", profile.country], ["Region", profile.region], ["Type", profile.schoolType],
                  ["Motto", profile.motto || "—"]].map(([k, v]) => (
                  <tr key={k}><td style={{color:"var(--muted)",fontWeight:800,width:160}}>{k}</td><td>{v}</td></tr>
                ))}
              </tbody></table>
            </div>
          </div>
        )}

      </section>

      {/* ── Modal ───────────────────────────────────────────────────────────── */}
      {modalKey && formConfig && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{formConfig.title}</h2>
              <button type="button" className="modal-close" onClick={closeModal}><X size={18} /></button>
            </div>
            <form className="modal-form" onSubmit={submitForm}>
              {formConfig.fields.map(field => (
                <label key={field.key} className="modal-field">
                  <span>{field.label}{field.required ? " *" : ""}</span>
                  <SmartInput f={field} value={form[field.key] || ""} data={data} onChange={v => setField(field.key, v)} />
                </label>
              ))}
              {formMsg && <p className={`form-notice ${formMsg.includes("success") || formMsg.includes("Saved") ? "ok" : "err"}`}>{formMsg}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Finance Summary Component ────────────────────────────────────────────────
function FinanceSummary({ schoolId }: { schoolId: string }) {
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    get<Record<string, number>>(`/api/finance/summary?schoolId=${schoolId}`).then(setSummary).catch(() => {});
  }, [schoolId]);
  if (!summary) return <div className="section-body"><p className="empty-state">Loading…</p></div>;
  return (
    <div className="section-body">
      <h2 className="section-heading">Finance Summary</h2>
      <div className="metrics-row">
        {[
          { label: "Total Invoiced",   value: `KSh ${Number(summary.totalInvoiced).toLocaleString("en-KE")}` },
          { label: "Total Collected",  value: `KSh ${Number(summary.totalCollected).toLocaleString("en-KE")}` },
          { label: "Outstanding",      value: `KSh ${Number(summary.totalBalance).toLocaleString("en-KE")}` },
          { label: "Total Expenses",   value: `KSh ${Number(summary.totalExpenses).toLocaleString("en-KE")}` },
          { label: "Paid Invoices",    value: String(summary.paidInvoices) },
          { label: "Open Invoices",    value: String(summary.openInvoices) },
        ].map(s => (
          <article key={s.label} className="stat-card">
            <span className="stat-label">{s.label}</span>
            <strong className="stat-value">{s.value}</strong>
          </article>
        ))}
      </div>
    </div>
  );
}

// ─── ListSection ──────────────────────────────────────────────────────────────
function ListSection({ title, rows, cols, onAdd, emptyMsg }: {
  title: string; rows: Row[]; cols: string[]; onAdd: () => void; emptyMsg?: string;
}) {
  return (
    <div className="section-body">
      <div className="section-header">
        <div><h2 className="section-heading">{title}</h2><span className="section-count">{rows.length} record{rows.length !== 1 ? "s" : ""}</span></div>
        <button className="add-btn" type="button" onClick={onAdd}><Plus size={15} /> Add</button>
      </div>
      <div className="panel">
        <T rows={rows} cols={cols} empty={emptyMsg || `No ${title.toLowerCase()} yet.`} />
      </div>
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────
function T({ rows, cols, empty }: { rows: Row[]; cols: string[]; empty: string }) {
  if (rows.length === 0) return <p className="empty-state">{empty}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{cols.map(c => <th key={c}>{c.replaceAll("_", " ")}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id || i)}>
              {cols.map(c => <td key={c}>{fmt(row[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmt(v: unknown): string {
  if (v == null) return "—";
  const s = String(v);
  if (s.match(/^\d{4}-\d{2}-\d{2}T/)) return s.slice(0, 10);
  return s.slice(0, 44);
}

// ─── SmartInput ───────────────────────────────────────────────────────────────
function SmartInput({ f, value, data, onChange }: { f: FieldDef; value: string; data: AllData; onChange: (v: string) => void }) {
  const sel = (opts: {value: string; label: string}[]) => (
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Select…</option>
      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
  switch (f.type) {
    case "select":          return sel((f.options || []).map(o => ({ value: o, label: o })));
    case "student-select":  return sel(data.students.map(s  => ({ value: String(s.id),  label: `${s.first_name} ${s.last_name} (${s.admission_no})` })));
    case "class-select":    return sel(data.classes.map(c   => ({ value: String(c.id),  label: String(c.name) })));
    case "teacher-select":  return sel(data.teachers.map(t  => ({ value: String(t.id),  label: String(t.full_name) })));
    case "parent-select":   return sel(data.parents.map(p   => ({ value: String(p.id),  label: String(p.full_name) })));
    case "invoice-select":  return sel(data.invoices.map(i  => ({ value: String(i.id),  label: `${i.invoice_no} — KSh ${i.balance} bal` })));
    case "exam-select":     return sel(data.exams.map(e     => ({ value: String(e.id),  label: String(e.name) })));
    case "subject-select":  return sel(data.subjects.map(s  => ({ value: String(s.id),  label: String(s.name) })));
    case "book-select":     return sel(data.libraryBooks.filter(b => Number(b.copies_available) > 0).map(b => ({ value: String(b.id), label: String(b.title) })));
    case "room-select":     return sel(data.hostelRooms.map(r => ({ value: String(r.id),  label: `${r.room_number} (${r.block || "—"})` })));
    case "textarea":        return <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} placeholder={`Enter ${f.label.toLowerCase()}`} />;
    case "date":            return <input type="date"   value={value} onChange={e => onChange(e.target.value)} />;
    case "time":            return <input type="time"   value={value} onChange={e => onChange(e.target.value)} />;
    case "number":          return <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder="0" />;
    case "email":           return <input type="email"  value={value} onChange={e => onChange(e.target.value)} placeholder={`Enter ${f.label.toLowerCase()}`} />;
    default:                return <input type="text"   value={value} onChange={e => onChange(e.target.value)} placeholder={`Enter ${f.label.toLowerCase()}`} />;
  }
}