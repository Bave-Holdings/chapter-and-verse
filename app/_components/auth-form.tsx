"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ApiError, authApi } from "../../lib/api";
import styles from "../page.module.css";

export function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    setError("");
    setSubmitting(true);
    try {
      if (mode === "signup") await authApi.signup(email, password);
      else await authApi.login(email, password);
      router.replace("/home");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to connect. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.field}>
        <label htmlFor={`${mode}-email`}>Email Address</label>
        <input id={`${mode}-email`} name="email" type="email" inputMode="email" autoComplete="email" placeholder="Example@gmail.com" required disabled={submitting} />
      </div>
      <div className={styles.field}>
        <label htmlFor={`${mode}-password`}>Password</label>
        <input id={`${mode}-password`} name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="Enter your password" minLength={mode === "signup" ? 8 : undefined} required disabled={submitting} />
      </div>
      {error && <p className={styles.formError} role="alert">{error}</p>}
      <button className={styles.submit} type="submit" disabled={submitting}>{submitting ? "Please wait…" : mode === "signup" ? "Sign Up" : "Log In"}</button>
    </form>
  );
}
