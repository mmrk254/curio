export type SchoolProfile = {
  id?: string;
  schoolName: string;
  email: string;
  password: string;
  phone: string;
  country: string;
  region: string;
  schoolType: string;
  motto: string;
  logo: string;
  createdAt: string;
};

export type CurioSession = {
  token: string;
  school: SchoolProfile;
  user: {
    id: string;
    fullName: string;
    email: string;
    status: string;
  };
};

const profileKey = "curio.school.profile";
const sessionKey = "curio.session.email";
const apiSessionKey = "curio.api.session";

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

export function readProfile(): SchoolProfile | null {
  if (!canUseStorage()) return null;

  const session = readApiSession();
  if (session) return session.school;

  const stored = window.localStorage.getItem(profileKey);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as SchoolProfile;
  } catch {
    return null;
  }
}

export function saveProfile(profile: SchoolProfile) {
  if (!canUseStorage()) return;

  window.localStorage.setItem(profileKey, JSON.stringify(profile));
  window.localStorage.setItem(sessionKey, profile.email);
}

export function saveApiSession(session: CurioSession) {
  if (!canUseStorage()) return;

  window.localStorage.setItem(apiSessionKey, JSON.stringify(session));
  window.localStorage.setItem(profileKey, JSON.stringify(session.school));
  window.localStorage.setItem(sessionKey, session.user.email);
}

export function readApiSession(): CurioSession | null {
  if (!canUseStorage()) return null;

  const stored = window.localStorage.getItem(apiSessionKey);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as CurioSession;
  } catch {
    return null;
  }
}

export function readSession() {
  if (!canUseStorage()) return null;

  return window.localStorage.getItem(sessionKey);
}

export function createSession(email: string) {
  if (!canUseStorage()) return;

  window.localStorage.setItem(sessionKey, email);
}

export function clearSession() {
  if (!canUseStorage()) return;

  window.localStorage.removeItem(sessionKey);
  window.localStorage.removeItem(apiSessionKey);
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
