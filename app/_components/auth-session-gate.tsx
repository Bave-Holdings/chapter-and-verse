"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { authApi } from "../../lib/api";
import styles from "../page.module.css";

export function AuthSessionGate({ children, variant = "login" }: { children: ReactNode; variant?: "login" | "signup" | "forgot" }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    authApi.me(controller.signal).then(
      () => {
        if (!controller.signal.aborted) router.replace("/home");
      },
      () => {
        // An expired session or unavailable API must still allow sign-in.
        if (!controller.signal.aborted) setChecking(false);
      },
    );

    return () => controller.abort();
  }, [router]);

  return (
    <div className={styles.sessionGate} aria-busy={checking}>
      <div className={checking ? styles.sessionPending : undefined} aria-hidden={checking || undefined} inert={checking}>
        {children}
      </div>
      {checking && (
        <div className={styles.sessionLoading} role="status" aria-label="Loading">
          <div aria-hidden="true">
            <div className={styles.intro}>
              <div className={`${styles.skeletonBlock} ${styles.skeletonTitle}`} />
              <div className={`${styles.skeletonBlock} ${styles.skeletonSubtitle}`} />
            </div>
            <div className={styles.form}>
              {Array.from({ length: variant === "signup" ? 4 : variant === "forgot" ? 1 : 2 }, (_, index) => (
                <div className={styles.field} key={index}>
                  <span className={`${styles.skeletonBlock} ${styles.skeletonLabel}`} />
                  <span className={`${styles.skeletonBlock} ${styles.skeletonInput}`} />
                </div>
              ))}
              {variant === "login" && <div className={styles.formOptions}>
                <span className={`${styles.skeletonBlock} ${styles.skeletonOption}`} />
                <span className={`${styles.skeletonBlock} ${styles.skeletonOption}`} />
              </div>}
              <div className={`${styles.submit} ${styles.skeletonBlock}`} />
              {variant === "forgot" && <div className={`${styles.unavailableNotice} ${styles.skeletonBlock} ${styles.skeletonNotice}`} />}
            </div>
            <div className={variant === "forgot" ? styles.backLink : styles.loginPrompt}>
              <span className={`${styles.skeletonBlock} ${styles.skeletonFooter}`} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
