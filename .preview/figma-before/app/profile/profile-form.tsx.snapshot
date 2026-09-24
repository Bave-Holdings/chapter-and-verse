"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { authApi, type User } from "../../lib/api";
import styles from "./profile.module.css";

export function ProfileForm() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    authApi.me().then(setUser).catch(() => undefined);
  }, []);

  return <div className={styles.profile}>
    <div className={styles.details}>
      <section className={styles.identity} aria-label="Profile overview">
        <Image className={styles.avatar} src="/profile-avatar.webp" alt="Profile placeholder" width={82} height={82} />
        <div className={styles.identityText}><h2>Account</h2><p>{user?.email ?? "Loading…"}</p></div>
        <button className={styles.editPhoto} disabled title="Avatar uploads are not supported yet">Photo unavailable</button>
      </section>

      <section className={styles.account} aria-labelledby="account-heading">
        <h2 id="account-heading">Account info</h2>
        <label htmlFor="profile-name">Name</label>
        <input id="profile-name" value="Unavailable" readOnly aria-describedby="profile-notice" />
        <div className={styles.emailField}><label htmlFor="profile-email">E-mail Address</label><input id="profile-email" type="email" value={user?.email ?? ""} readOnly autoComplete="email" /></div>
        <p className={styles.notice} id="profile-notice" role="status">Names, avatars, and profile editing will be available after the backend adds those account fields and endpoints.</p>
      </section>
    </div>

    <section className={styles.passwordCard} aria-labelledby="password-heading">
      <h2 id="password-heading">Change Password</h2>
      <p className={styles.notice}>Password changes are currently unavailable because the backend does not provide a change-password endpoint.</p>
      <div className={styles.passwordForm} aria-disabled="true">
        <div className={styles.passwordField}><label htmlFor="current-password">Current Password</label><input id="current-password" type="password" placeholder="Unavailable" disabled /></div>
        <div className={styles.passwordField}><label htmlFor="new-password">New Password</label><input id="new-password" type="password" placeholder="Unavailable" disabled /></div>
        <button className={styles.submit} type="button" disabled>Change Password</button>
      </div>
    </section>
  </div>;
}
