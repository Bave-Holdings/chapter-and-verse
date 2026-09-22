import Image from "next/image";
import Link from "next/link";

import { ProductPreview } from "./_components/product-preview";
import { AuthForm } from "./_components/auth-form";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.authPanel} aria-labelledby="signup-heading">
        <div className={`${styles.authContent} ${styles.signupContent}`}>
          <Image
            className={styles.logo}
            src="/chapter-verse-logo-light.svg"
            alt="Chapter & Verse - Hey, quick question. An Intellence product"
            width={345}
            height={85}
            priority
          />

          <header className={styles.intro}>
            <h1 id="signup-heading">
              <span className={styles.desktopHeading}>Create Your Account</span>
              <span className={styles.mobileHeading}>Welcome Back!</span>
            </h1>
            <p>
              <span className={styles.desktopHeading}>Create your account and start your journey with us.</span>
              <span className={styles.mobileHeading}>Please enter your credentials to continue.</span>
            </p>
          </header>

          <AuthForm mode="signup" />

          <p className={styles.loginPrompt}>
            Already have an account? <Link href="/login">Log In</Link>
          </p>
        </div>
      </section>
      <ProductPreview />
    </main>
  );
}
