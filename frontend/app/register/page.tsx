"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Globe2,
  ImageUp,
  Lock,
  Mail,
  MapPin,
  Phone,
  School,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { registerSchool } from "@/lib/curio-api";
import { fileToDataUrl, saveApiSession } from "@/lib/curio-session";

type FormState = {
  schoolName: string;
  email: string;
  password: string;
  phone: string;
  country: string;
  region: string;
  schoolType: string;
  motto: string;
};

const initialForm: FormState = {
  schoolName: "",
  email: "",
  password: "",
  phone: "",
  country: "Kenya",
  region: "",
  schoolType: "Private School",
  motto: "",
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [logo, setLogo] = useState("");
  const [error, setError] = useState("");

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleLogo(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload a school logo image.");
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    setLogo(dataUrl);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.schoolName || !form.email || !form.password || !form.region) {
      setError("School name, email, password, and region are required.");
      return;
    }

    if (form.password.length < 6) {
      setError("Use at least 6 characters for the password.");
      return;
    }

    try {
      const session = await registerSchool({ ...form, logo });
      saveApiSession(session);
      router.push("/dashboard");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Registration failed. Check that the backend is running.");
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-visual">
        <Link className="auth-brand" href="/">
          <span className="brand-mark">C</span>
          <span>
            <strong>CURIO</strong>
            <small>Education ERP</small>
          </span>
        </Link>
        <motion.div
          className="auth-copy"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <p>School setup</p>
          <h1>Register the institution once. Run the school from one place.</h1>
          <p>
            Capture the identity of the school first. CURIO will carry this profile into
            admissions, finance, academics, and parent communication as the system grows.
          </p>
        </motion.div>
      </section>

      <section className="auth-panel-wrap">
        <motion.div
          className="auth-panel"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Create workspace</p>
              <h2>Register School</h2>
              <p>Use real details here. They appear immediately on the dashboard.</p>
            </div>
            <Link className="text-link" href="/login">
              Login
            </Link>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <label className="field full">
                <span>School logo</span>
                <div className="logo-upload">
                  {logo ? (
                    <img className="logo-preview" src={logo} alt="School logo preview" />
                  ) : (
                    <div className="logo-preview fallback-logo">
                      <ImageUp size={26} />
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleLogo(event.target.files?.[0])}
                    />
                    <p className="helper-text">PNG or JPG works well. The logo is stored locally for now.</p>
                  </div>
                </div>
              </label>

              <label className="field">
                <span>School name</span>
                <div className="input-shell">
                  <School size={18} />
                  <input
                    value={form.schoolName}
                    onChange={(event) => updateField("schoolName", event.target.value)}
                    placeholder="CURIO Academy"
                  />
                </div>
              </label>

              <label className="field">
                <span>Official email</span>
                <div className="input-shell">
                  <Mail size={18} />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    placeholder="admin@school.ac.ke"
                  />
                </div>
              </label>

              <label className="field">
                <span>Password</span>
                <div className="input-shell">
                  <Lock size={18} />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => updateField("password", event.target.value)}
                    placeholder="Minimum 6 characters"
                  />
                </div>
              </label>

              <label className="field">
                <span>Phone</span>
                <div className="input-shell">
                  <Phone size={18} />
                  <input
                    value={form.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                    placeholder="+254 700 000 000"
                  />
                </div>
              </label>

              <label className="field">
                <span>Country</span>
                <div className="input-shell">
                  <Globe2 size={18} />
                  <select
                    value={form.country}
                    onChange={(event) => updateField("country", event.target.value)}
                  >
                    <option>Kenya</option>
                    <option>Uganda</option>
                    <option>Tanzania</option>
                    <option>Rwanda</option>
                    <option>Ghana</option>
                    <option>Nigeria</option>
                    <option>South Africa</option>
                  </select>
                </div>
              </label>

              <label className="field">
                <span>County / region</span>
                <div className="input-shell">
                  <MapPin size={18} />
                  <input
                    value={form.region}
                    onChange={(event) => updateField("region", event.target.value)}
                    placeholder="Nairobi"
                  />
                </div>
              </label>

              <label className="field">
                <span>School type</span>
                <div className="input-shell">
                  <Building2 size={18} />
                  <select
                    value={form.schoolType}
                    onChange={(event) => updateField("schoolType", event.target.value)}
                  >
                    <option>Private School</option>
                    <option>Public School</option>
                    <option>International School</option>
                    <option>TVET / College</option>
                    <option>University</option>
                  </select>
                </div>
              </label>

              <label className="field full">
                <span>Motto or short mission</span>
                <div className="input-shell">
                  <input
                    value={form.motto}
                    onChange={(event) => updateField("motto", event.target.value)}
                    placeholder="Learning with discipline, care, and ambition"
                  />
                </div>
              </label>
            </div>

            {error ? <p className="error-text">{error}</p> : null}

            <button className="primary-action" type="submit">
              Create School Workspace
              <ArrowRight size={18} />
            </button>
          </form>
        </motion.div>
      </section>
    </main>
  );
}
