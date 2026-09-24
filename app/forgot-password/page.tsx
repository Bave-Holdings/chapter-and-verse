import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "../_components/auth-shell";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Forgot Password | Chapter & Verse",
  description: "Request a password reset email for your Chapter & Verse account.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell variant="forgot">
      <header className={styles.intro}>
        <h1 id="forgot-password-heading">Forgot Password!</h1>
        <p>Please provide your registered email address to receive the verification email.</p>
      </header>

      <div className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="reset-email">Email Address</label>
          <input id="reset-email" type="email" placeholder="Example@gmail.com" autoComplete="email" disabled aria-describedby="reset-notice" />
        </div>
        <button className={styles.submit} type="button" disabled>Send reset link</button>
        <p className={styles.unavailableNotice} id="reset-notice" role="status">Password reset is not available yet. Contact your administrator for account access.</p>
      </div>

      <Link className={styles.backLink} href="/login">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m10 6-6 6 6 6M4 12h16" />
        </svg>
        <span>Go back</span>
      </Link>
    </AuthShell>
  );
}
