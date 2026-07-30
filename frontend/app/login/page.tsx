"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { loginSchool } from "@/lib/curio-api";
import { readSession, saveApiSession } from "@/lib/curio-session";

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (readSession()) {
      router.replace("/dashboard");
    }
  }, [mounted, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const session = await loginSchool(email, password);
      saveApiSession(session);
      router.push("/dashboard");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login failed. Check that the backend is running.");
    }
  }

  if (!mounted) return null;

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
          <p>Welcome back</p>
          <h1>Pick up school operations exactly where you left them.</h1>
          <p>
            Login to admissions, finance, academics, and reporting from the same command
            center.
          </p>
        </motion.div>
      </section>

      <section className="auth-panel-wrap">
        <motion.div
          className="auth-panel compact"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Secure access</p>
              <h2>Login</h2>
              <p>Use the school email and password you registered with.</p>
            </div>
            <Link className="text-link" href="/register">
              Register
            </Link>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <label className="field full">
                <span>Email</span>
                <div className="input-shell">
                  <Mail size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="admin@school.ac.ke"
                  />
                </div>
              </label>

              <label className="field full">
                <span>Password</span>
                <div className="input-shell">
                  <Lock size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter password"
                  />
                </div>
              </label>
            </div>

            {error ? <p className="error-text">{error}</p> : null}

            <button className="primary-action" type="submit">
              Enter Dashboard
              <ArrowRight size={18} />
            </button>
          </form>
        </motion.div>
      </section>
    </main>
  );
}