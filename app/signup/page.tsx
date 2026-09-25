import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "../_components/auth-shell";
import { AuthForm } from "../_components/auth-form";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Sign Up | Chapter & Verse",
  description: "Create your Chapter & Verse account.",
};

export default function SignupPage() {
  return (
    <AuthShell variant="signup">
      <header className={styles.intro}>
        <h1>Create Your Account</h1>
        <p>Create your account and start your journey with us.</p>
      </header>

      <AuthForm mode="signup" />

      <p className={styles.loginPrompt}>
        Already have an account? <Link href="/login">Log In</Link>
      </p>
    </AuthShell>
  );
}
