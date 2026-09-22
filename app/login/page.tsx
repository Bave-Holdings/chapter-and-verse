import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ProductPreview } from "../_components/product-preview";
import { AuthForm } from "../_components/auth-form";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Log In | Chapter & Verse",
  description: "Log in to your Chapter & Verse account.",
};

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <section className={styles.authPanel} aria-labelledby="login-heading">
        <div className={styles.authContent}>
          <Image
            className={styles.logo}
            src="/chapter-verse-logo-light.svg"
            alt="Chapter & Verse - Hey, quick question. An Intellence product"
            width={345}
            height={85}
            priority
          />

          <header className={styles.intro}>
            <h1 id="login-heading">Welcome Back!</h1>
            <p>Please enter your credentials to continue.</p>
          </header>

          <AuthForm mode="login" />

          <div className={styles.authHelp}>
            <Link className={styles.forgotLink} href="/forgot-password">Forgot password?</Link>
          </div>

          <p className={styles.loginPrompt}>
            Don&apos;t have an account? <Link href="/">Sign up</Link>
          </p>
        </div>
      </section>
      <ProductPreview />
    </main>
  );
}
