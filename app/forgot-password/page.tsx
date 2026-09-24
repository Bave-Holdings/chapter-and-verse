import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ProductPreview } from "../_components/product-preview";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Forgot Password | Chapter & Verse",
  description: "Request a password reset email for your Chapter & Verse account.",
};

export default function ForgotPasswordPage() {
  return (
    <main className={styles.page}>
      <section
        className={styles.authPanel}
        aria-labelledby="forgot-password-heading"
      >
        <div className={`${styles.authContent} ${styles.forgotContent}`}>
          <Image
            className={styles.logo}
            src="/chapter-verse-logo-light.svg"
            alt="Chapter & Verse - Hey, quick question. An Intellence product"
            width={345}
            height={85}
            priority
          />

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
        </div>
      </section>

      <ProductPreview />
    </main>
  );
}
