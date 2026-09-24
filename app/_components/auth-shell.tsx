import Image from "next/image";
import type { ReactNode } from "react";

import { AuthSessionGate } from "./auth-session-gate";
import { ProductPreview } from "./product-preview";
import styles from "../page.module.css";

export function AuthShell({ children, variant }: { children: ReactNode; variant?: "signup" | "forgot" }) {
  const variantClass = variant === "signup" ? styles.signupContent : variant === "forgot" ? styles.forgotContent : "";

  return (
    <main className={styles.page}>
      <section className={styles.authPanel} aria-label="Account access">
        <div className={`${styles.authContent} ${variantClass}`}>
          <Image
            className={styles.logo}
            src="/chapter-verse-logo-light.svg"
            alt="Chapter & Verse - Hey, quick question. An Intellence product"
            width={345}
            height={85}
            priority
          />
          <AuthSessionGate variant={variant}>{children}</AuthSessionGate>
        </div>
      </section>
      <ProductPreview />
    </main>
  );
}
