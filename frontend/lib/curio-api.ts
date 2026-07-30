import { CurioSession, SchoolProfile } from "@/lib/curio-session";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";

function toSchoolProfile(school: Record<string, unknown>): SchoolProfile {
  return {
    id: String(school.id),
    schoolName: String(school.name ?? ""),
    email: String(school.email ?? ""),
    password: "",
    phone: String(school.phone ?? ""),
    country: String(school.country ?? ""),
    region: String(school.region ?? ""),
    schoolType: String(school.school_type ?? ""),
    motto: String(school.motto ?? ""),
    logo: String(school.logo ?? ""),
    createdAt: String(school.created_at ?? ""),
  };
}

function toSession(payload: Record<string, unknown>): CurioSession {
  const user = payload.user as Record<string, unknown>;
  return {
    token: String(payload.token),
    school: toSchoolProfile(payload.school as Record<string, unknown>),
    user: {
      id: String(user.id),
      fullName: String(user.full_name ?? ""),
      email: String(user.email ?? ""),
      status: String(user.status ?? ""),
    },
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || `Request failed with ${response.status}`);
  }

  return data as T;
}

export async function registerSchool(input: {
  schoolName: string;
  email: string;
  password: string;
  phone: string;
  country: string;
  region: string;
  schoolType: string;
  motto: string;
  logo: string;
}) {
  const payload = await request<Record<string, unknown>>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return toSession(payload);
}

export async function loginSchool(email: string, password: string) {
  const payload = await request<Record<string, unknown>>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return toSession(payload);
}

export async function getDashboard(schoolId: string) {
  return request<Record<string, unknown>>(`/api/dashboard?schoolId=${schoolId}`);
}

export async function listResource(resource: string, schoolId: string) {
  return request<Record<string, unknown>[]>(`/api/${resource}?schoolId=${schoolId}`);
}

export async function createResource(resource: string, body: Record<string, unknown>) {
  return request<Record<string, unknown>>(`/api/${resource}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
