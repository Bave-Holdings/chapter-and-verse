"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ApiError, authApi } from "../../lib/api";
import styles from "../page.module.css";

type FieldErrors = Partial<Record<"fullName" | "email" | "password" | "confirmPassword", string>>;

export function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((current) => {
      if (!current[field] && !(field === "password" && current.confirmPassword)) return current;
      const next = { ...current };
      delete next[field];
      if (field === "password") delete next.confirmPassword;
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const fullName = String(values.get("full_name") ?? "").trim();
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    const confirmPassword = String(values.get("confirm_password") ?? "");
    const nextErrors: FieldErrors = {};

    if (mode === "signup" && !fullName) nextErrors.fullName = "Full name is required.";
    if (!email) nextErrors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Password is required.";
    else if (mode === "signup" && password.length < 8) nextErrors.password = "Password must be at least 8 characters.";
    if (mode === "signup" && !confirmPassword) nextErrors.confirmPassword = "Confirm password is required.";
    else if (mode === "signup" && confirmPassword !== password) nextErrors.confirmPassword = "Passwords do not match.";

    setError("");
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (mode === "signup") await authApi.signup(fullName, email, password);
      else await authApi.login(email, password);
      router.replace("/home");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to connect. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={`${styles.form} ${mode === "signup" ? styles.signupForm : ""}`} onSubmit={submit} noValidate>
      {mode === "signup" && <div className={styles.field}>
        <label htmlFor="signup-full-name">Full Name</label>
        <input id="signup-full-name" name="full_name" type="text" autoComplete="name" placeholder="Enter your full name" required disabled={submitting} aria-invalid={Boolean(fieldErrors.fullName)} aria-describedby={fieldErrors.fullName ? "signup-full-name-error" : undefined} onChange={() => clearFieldError("fullName")} />
        {fieldErrors.fullName && <p className={styles.fieldError} id="signup-full-name-error">{fieldErrors.fullName}</p>}
      </div>}
      <div className={styles.field}>
        <label htmlFor={`${mode}-email`}>Email Address</label>
        <input id={`${mode}-email`} name="email" type="email" inputMode="email" autoComplete="email" placeholder="Example@gmail.com" required disabled={submitting} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? `${mode}-email-error` : undefined} onChange={() => clearFieldError("email")} />
        {fieldErrors.email && <p className={styles.fieldError} id={`${mode}-email-error`}>{fieldErrors.email}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor={`${mode}-password`}>Password</label>
        <input id={`${mode}-password`} name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="Enter your password" minLength={mode === "signup" ? 8 : undefined} required disabled={submitting} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? `${mode}-password-error` : undefined} onChange={() => clearFieldError("password")} />
        {fieldErrors.password && <p className={styles.fieldError} id={`${mode}-password-error`}>{fieldErrors.password}</p>}
      </div>
      {mode === "signup" && <div className={styles.field}>
        <label htmlFor="signup-confirm-password">Confirm Password</label>
        <input id="signup-confirm-password" name="confirm_password" type="password" autoComplete="new-password" placeholder="Confirm your password" required disabled={submitting} aria-invalid={Boolean(fieldErrors.confirmPassword)} aria-describedby={fieldErrors.confirmPassword ? "signup-confirm-password-error" : undefined} onChange={() => clearFieldError("confirmPassword")} />
        {fieldErrors.confirmPassword && <p className={styles.fieldError} id="signup-confirm-password-error">{fieldErrors.confirmPassword}</p>}
      </div>}
      {error && <p className={styles.formError} role="alert">{error}</p>}
      <button className={styles.submit} type="submit" disabled={submitting}>{submitting ? "Please wait…" : mode === "signup" ? "Sign Up" : "Log In"}</button>
    </form>
  );
}
