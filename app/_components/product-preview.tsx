import Image from "next/image";
import type { ReactNode } from "react";

import styles from "./product-preview.module.css";

type IconName = "grid" | "home" | "chart" | "shield" | "users" | "lock" | "chevron" | "plus" | "history" | "download" | "sun" | "send" | "heart" | "thumb";

function PreviewIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
    home: <><path d="m4 8 6-4a4 4 0 0 1 4 0l6 4a3 3 0 0 1 1 3l-2 8a3 3 0 0 1-3 2H8a3 3 0 0 1-3-2l-2-8a3 3 0 0 1 1-3Z" /><path d="M9 17h6" /></>,
    chart: <><path d="M4 3v18h17" /><path d="m7 15 4-7 4 4 5-7" /></>,
    shield: <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />,
    users: <><circle cx="10" cy="7" r="4" /><path d="M3 21v-3a7 7 0 0 1 14 0v3M17 3a4 4 0 0 1 0 8M19 14a6 6 0 0 1 3 5v2" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    plus: <path d="M12 5v14M5 12h14" />,
    history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7" /><path d="M12 7v5l-3 2" /></>,
    download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    send: <path d="M12 20V4m-7 7 7-7 7 7" />,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    thumb: <path d="M8 10V3H3v10h5m0-3 5 10c2 0 3-2 2-5l-1-3h5c2 0 2-2 2-3l-2-6H8" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function WavePattern({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 520 260" fill="none" aria-hidden="true">
      {Array.from({ length: 14 }, (_, index) => (
        <path
          d={`M-20 ${52 + index * 9} C85 ${-25 + index * 8}, 178 ${20 + index * 5}, 252 ${84 + index * 4} S410 ${190 + index * 2}, 548 ${70 + index * 8}`}
          key={index}
        />
      ))}
    </svg>
  );
}

const libraries: { label: string; icon: IconName }[] = [
  { label: "Mortgage", icon: "home" },
  { label: "Investment", icon: "chart" },
  { label: "Compliance", icon: "shield" },
  { label: "HR", icon: "users" },
];

export function ProductPreview() {
  return (
    <aside className={styles.visualPanel} aria-hidden="true">
      <WavePattern className={styles.dotPatternTop} />
      <WavePattern className={styles.dotPatternLeft} />
      <WavePattern className={styles.dotPatternBottom} />
      <div className={styles.productPreview}>
        <div className={styles.previewWindow}>
          <div className={styles.sidebar}>
            <div className={styles.brand}>
              <Image src="/chapter-verse-mark.svg" alt="" width={30} height={31} />
              <div><strong>Chapter &amp; Verse</strong><small>AN INTELLENCE PRODUCT</small></div>
            </div>
            <div className={styles.newQuestion}><PreviewIcon name="plus" /><span>New Question</span></div>
            <p className={styles.sectionLabel}>WORKSPACE</p>
            <div className={styles.navigation}>
              <div className={`${styles.navItem} ${styles.allLibraries}`}><PreviewIcon name="grid" /><span>All Libraries</span></div>
              {libraries.map(({ label, icon }) => (
                <div className={`${styles.navItem} ${label === "Mortgage" ? styles.activeLibrary : ""}`} key={label}>
                  <PreviewIcon name={icon} /><span>{label}</span>
                  {label === "HR" ? <span className={styles.request}><PreviewIcon name="lock" />Request</span> : <span className={styles.navArrow}><PreviewIcon name="chevron" /></span>}
                </div>
              ))}
            </div>
            <div className={styles.recent}>
              <p>RECENT</p>
              <div>Personal AI tools and client data</div>
              <div>FHA self-employed, 18 months</div>
              <div>TRID tolerance cure deadline</div>
              <div>Re-up approval under the IPS</div>
            </div>
            <div className={styles.profile}>
              <Image src="/workspace-avatar.webp" alt="" width={30} height={30} />
              <div><strong>Syed</strong><span>Compliance</span></div>
              <PreviewIcon name="sun" />
            </div>
          </div>

          <div className={styles.workspace}>
            <div className={styles.toolbar}>
              <div className={styles.scope}><small>Scope</small><strong>Mortgage</strong><PreviewIcon name="chevron" /><strong>FHA</strong></div>
              <div className={styles.topics}>
                {["Income", "Credit", "Assets", "Property"].map((topic) => <span className={topic === "Income" ? styles.activeTopic : undefined} key={topic}>{topic}</span>)}
              </div>
              <span className={styles.toolbarAction}><PreviewIcon name="history" /></span>
              <span className={styles.toolbarAction}><PreviewIcon name="download" />Export</span>
            </div>

            <div className={styles.question}>
              <p>Syed · Mortgage Compliance · 2:16 PM</p>
              <div>Gravida aliquet ornare cursus aenean massa arcu non.</div>
            </div>
            <div className={styles.response}>
              <span className={styles.assistantAvatar}><Image src="/chat-avatar.webp" alt="" width={22} height={22} /><i /></span>
              <div className={styles.answer}>
                <div className={styles.answerContext}><i />Answering from Cross-program · TILA &amp; RESPA · auto-detected</div>
                <span className={styles.answerHighlight}>60 days after consummation</span>
                <p>Refund the excess to the borrower and deliver a corrected Closing Disclosure showing the refund, both within 60 days of consummation.</p>
                <div className={styles.sources}>
                  <span><i />TILA–RESPA §1026.19(f), p. 8</span>
                  <span className={styles.firmSource}><i />Firm overlay, p. 2</span>
                </div>
                <div className={styles.feedback}><span><PreviewIcon name="heart" />Helpful</span><span><PreviewIcon name="thumb" />Not helpful</span><span>Report issue</span></div>
              </div>
            </div>
            <div className={styles.composer}><span>Hey, quick question...</span><span className={styles.send}><PreviewIcon name="send" /></span></div>
            <p className={styles.disclaimer}>Answers come only from your firm&apos;s documents. Check the cited page before acting. Not legal advice.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
