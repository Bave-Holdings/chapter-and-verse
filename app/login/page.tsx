import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "../_components/auth-shell";
import { AuthForm } from "../_components/auth-form";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Log In | Chapter & Verse",
  description: "Log in to your Chapter & Verse account.",
};

export default function LoginPage() {
  return (
    <AuthShell>
      <header className={styles.intro}>
        <h1 id="login-heading">Welcome Back!</h1>
        <p>Please enter your credentials to continue.</p>
      </header>

      <AuthForm mode="login" />

      <p className={styles.loginPrompt}>
        Don&apos;t have an account? <Link href="/signup">Sign up</Link>
      </p>
    </AuthShell>
  );
}
