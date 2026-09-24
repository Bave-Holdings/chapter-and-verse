"use client";

import { useEffect, useState } from "react";

import { authApi, type User } from "../../lib/api";
import styles from "./profile.module.css";

export function ProfileForm() {
  const [user, setUser] = useState<User | null>(null);
  const [passwordExpanded, setPasswordExpanded] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const name = user?.full_name?.trim() || "Account";
  const initials = (user?.full_name || user?.email || "U").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  useEffect(() => {
    authApi.me().then(setUser).catch(() => setLoadFailed(true));
  }, []);

  return <div className={styles.profile}>
    <div className={styles.details}>
      <section className={styles.identity} aria-label="Profile overview">
        <span className={styles.avatar} aria-hidden="true">{initials}</span>
        <div className={styles.identityText}><h2>{name}</h2><p>{user?.email ?? (loadFailed ? "Unable to load account" : "Loading…")}</p></div>
        <button className={styles.editPhoto} disabled title="Photo editing is not available yet">Edit Photo</button>
      </section>

      <section className={styles.account} aria-labelledby="account-heading">
        <h2 id="account-heading">Account info</h2>
        <label htmlFor="profile-name">Name</label>
        <input id="profile-name" value={user?.full_name ?? ""} placeholder={loadFailed ? "Unable to load name" : user ? "No name provided" : "Loading…"} readOnly aria-describedby="profile-notice" />
        <div className={styles.emailField}><label htmlFor="profile-email">E-mail Address</label><input id="profile-email" type="email" value={user?.email ?? ""} readOnly autoComplete="email" /></div>
        <p className={styles.notice} id="profile-notice" role="status">{loadFailed ? "Your account details could not be loaded. Please refresh to try again." : "Profile editing is not available yet."}</p>
      </section>
    </div>

    <section className={styles.passwordCard} aria-labelledby="password-heading">
      <h2 id="password-heading" className={styles.desktopPasswordHeading}>Change Password</h2>
      <button type="button" className={styles.passwordToggle} aria-expanded={passwordExpanded} aria-controls="password-fields" onClick={() => setPasswordExpanded((expanded) => !expanded)}>Change Password<svg viewBox="0 0 24 24" className={!passwordExpanded ? styles.collapsed : undefined} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
      <div id="password-fields" className={`${styles.passwordForm} ${!passwordExpanded ? styles.passwordCollapsed : ""}`} aria-disabled="true">
        <div className={styles.passwordField}><label htmlFor="current-password">Current Password</label><input id="current-password" type="password" placeholder="Enter Current Password" autoComplete="current-password" disabled /></div>
        <div className={styles.passwordField}><label htmlFor="new-password">New Password</label><input id="new-password" type="password" placeholder="Enter New Password" autoComplete="new-password" disabled /></div>
        <div className={styles.passwordField}><label htmlFor="confirm-new-password">Confirm Password</label><input id="confirm-new-password" type="password" placeholder="Confirm Password" autoComplete="new-password" disabled /></div>
        <p className={styles.notice}>Password changes are not available yet. Contact your administrator for help.</p>
        <button className={styles.submit} type="button" disabled>Change Password</button>
      </div>
    </section>
  </div>;
}
